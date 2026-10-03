import React, { useEffect, useRef, useState } from "react";
import { useLocal } from "./store";
import { explainImage, NARRATION_LANGUAGES, speechChunks } from "./narration";

export default function ChapterNarration({
  chapterId,
  pages,
  current,
  onPage,
}) {
  const [mode, setMode] = useLocal("narration-mode", "free");
  const [language, setLanguage] = useLocal("narration-language", "en");
  const [rate, setRate] = useLocal("narration-rate", 1);
  const [saved, setSaved] = useLocal("narration-chapters", {});
  const [key, setKey] = useState("");
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("stopped");
  const run = useRef(0),
    worker = useRef(null),
    abort = useRef(null),
    utterance = useRef(null),
    speechRun = useRef(0);
  const group = `${chapterId}:${mode}:${language}`;
  const texts = saved[group]?.texts || {};
  const currentText = texts[current] || "";
  const availableVoices = voices.filter(
    (v) => v.lang.split(/[-_]/)[0] === language,
  );
  const voice =
    availableVoices.find((v) => v.voiceURI === voiceURI) || availableVoices[0];
  const supported = typeof window.speechSynthesis !== "undefined";
  const stopSpeech = () => {
    speechRun.current++;
    window.speechSynthesis?.cancel();
    utterance.current = null;
    setStatus("stopped");
  };
  const cancel = () => {
    run.current++;
    abort.current?.abort();
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  };
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.addEventListener("voiceschanged", update);
    return () => {
      synth.removeEventListener("voiceschanged", update);
    };
  }, []);
  useEffect(
    () => () => {
      run.current++;
      speechRun.current++;
      abort.current?.abort();
      worker.current?.terminate();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const saveText = (page, text) =>
    setSaved((old) => {
      const entries = Object.entries(old)
        .filter(([id]) => id !== group)
        .slice(-4);
      return {
        ...Object.fromEntries(entries),
        [group]: {
          texts: { ...old[group]?.texts, [page]: text.slice(0, 12000) },
        },
      };
    });
  const prepare = async (whole) => {
    if (busy) return;
    if (mode === "ai" && !key.trim()) {
      setMessage("Enter your Gemini API key first.");
      return;
    }
    stopSpeech();
    setBusy(true);
    const token = ++run.current;
    const controller = new AbortController();
    abort.current = controller;
    let localWorker;
    try {
      if (mode === "free") {
        setMessage(
          "Loading on-device OCR. The first run downloads a language model.",
        );
        const { createWorker } = await import("tesseract.js");
        if (token !== run.current) return;
        localWorker = await createWorker(
          NARRATION_LANGUAGES.find(([code]) => code === language)?.[2] || "eng",
        );
        if (token !== run.current) {
          await localWorker.terminate();
          return;
        }
        worker.current = localWorker;
      }
      const indices = whole ? pages.map((_, i) => i) : [current];
      for (const index of indices) {
        if (token !== run.current) break;
        if (texts[index]) continue;
        setMessage(
          `${mode === "ai" ? "Explaining" : "Reading text on"} page ${index + 1} of ${pages.length}…`,
        );
        const response = await fetch(pages[index], {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
        });
        if (!response.ok)
          throw new Error(
            "Page image could not load. Try another reading source.",
          );
        const blob = await response.blob();
        if (blob.size > 12 * 1024 * 1024)
          throw new Error("Page image exceeds the 12 MB limit.");
        let text;
        if (mode === "ai")
          text = await explainImage(blob, {
            key,
            language,
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(60000),
            ]),
          });
        else {
          const result = await localWorker.recognize(blob);
          text = result.data.text.trim();
        }
        if (token !== run.current) break;
        saveText(index, text);
      }
      if (token === run.current)
        setMessage(
          "Preparation finished. Check the transcript, then press Listen. Empty pages may contain no readable text.",
        );
    } catch (error) {
      if (token === run.current)
        setMessage(
          error.name === "TypeError"
            ? "This source blocks image access or the network is unavailable. Try another reading source."
            : error.message || "Could not prepare narration.",
        );
    } finally {
      if (localWorker && worker.current === localWorker) {
        worker.current = null;
        await localWorker.terminate();
      }
      if (token === run.current) setBusy(false);
    }
  };
  const listen = (whole) => {
    stopSpeech();
    if (!voice) {
      setMessage(
        "No voice for this language is installed. Add a system voice or choose another language.",
      );
      return;
    }
    const chunks = (whole ? pages.map((_, i) => i) : [current]).flatMap(
      (page) => speechChunks(texts[page] || "").map((text) => ({ page, text })),
    );
    if (!chunks.length) return;
    const token = speechRun.current;
    setStatus("playing");
    const speak = (index) => {
      if (token !== speechRun.current) return;
      if (index >= chunks.length) {
        setStatus("stopped");
        return;
      }
      const part = chunks[index];
      const speech = new SpeechSynthesisUtterance(part.text);
      utterance.current = speech;
      speech.voice = voice;
      speech.lang = voice.lang;
      speech.rate = Number(rate);
      speech.onstart = () => {
        if (token === speechRun.current) onPage(part.page);
      };
      speech.onend = () => speak(index + 1);
      speech.onerror = () => {
        if (token === speechRun.current) {
          setStatus("stopped");
          setMessage(
            "Audio could not play. Press Listen again or choose another voice.",
          );
        }
      };
      window.speechSynthesis.speak(speech);
    };
    speak(0);
  };
  return (
    <section
      className="chapter-narration"
      aria-label="Read and listen controls"
    >
      <div className="narration-heading">
        <div>
          <span className="eyebrow">READ &amp; LISTEN</span>
          <h2>Chapter companion</h2>
        </div>
        <span>
          Page {current + 1} / {pages.length}
        </span>
      </div>
      <div className="narration-settings">
        <label>
          Experience
          <select
            aria-label="Narration mode"
            value={mode}
            disabled={busy}
            onChange={(e) => {
              stopSpeech();
              setMode(e.target.value);
              setMessage("");
            }}
          >
            <option value="free">Free · page text read-aloud</option>
            <option value="ai">AI · picture explanation</option>
          </select>
        </label>
        <label>
          {mode === "free" ? "Printed text language" : "Explanation language"}
          <select
            aria-label="Narration language"
            value={language}
            disabled={busy}
            onChange={(e) => {
              stopSpeech();
              setLanguage(e.target.value);
              setMessage("");
            }}
          >
            {NARRATION_LANGUAGES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Voice
          <select
            aria-label="Narration voice"
            value={voice?.voiceURI || ""}
            onChange={(e) => {
              stopSpeech();
              setVoiceURI(e.target.value);
            }}
          >
            {!availableVoices.length && (
              <option value="">No matching device voice</option>
            )}
            {availableVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Speed
          <select
            aria-label="Narration speed"
            value={rate}
            onChange={(e) => {
              stopSpeech();
              setRate(Number(e.target.value));
            }}
          >
            {[0.75, 1, 1.25, 1.5, 2].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
      </div>
      {mode === "ai" ? (
        <>
          <p>
            Explain the visible pictures in your chosen language. AI may misread
            panels; review the transcript. Generating sends page images to
            Google and uses your API quota. Preparing a chapter makes up to{" "}
            {pages.length} requests; cached pages are reused.
          </p>
          <label className="narration-key">
            Your Gemini API key
            <input
              type="password"
              autoComplete="off"
              aria-label="Gemini API key"
              placeholder="Used only in this open chapter"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <button onClick={() => setKey("")}>Clear key</button>
        </>
      ) : (
        <p>
          Free OCR extracts printed text on your device, without translation or
          story explanation. Speech uses your device/browser voices, which may
          use a network service. Stylized lettering and panel order can be
          misread.
        </p>
      )}
      <div className="narration-actions">
        <button disabled={busy} onClick={() => prepare(false)}>
          Prepare this page
        </button>
        <button disabled={busy} onClick={() => prepare(true)}>
          Prepare chapter
        </button>
        {busy && (
          <button
            onClick={() => {
              cancel();
              setMessage("Preparation stopped. Completed pages are saved.");
            }}
          >
            Cancel preparation
          </button>
        )}
        <button
          disabled={!supported || !voice || !currentText || busy}
          onClick={() => listen(false)}
        >
          Listen to page
        </button>
        <button
          disabled={
            !supported || !voice || !Object.values(texts).some(Boolean) || busy
          }
          onClick={() => listen(true)}
        >
          Listen to prepared pages
        </button>
        <button
          disabled={status === "stopped"}
          onClick={() => {
            if (status === "paused") {
              window.speechSynthesis.resume();
              setStatus("playing");
            } else {
              window.speechSynthesis.pause();
              setStatus("paused");
            }
          }}
        >
          {status === "paused" ? "Resume audio" : "Pause audio"}
        </button>
        <button disabled={status === "stopped"} onClick={stopSpeech}>
          Stop audio
        </button>
      </div>
      {status !== "stopped" && (
        <div className="narration-mini" aria-label="Active narration">
          <span>
            🎧 Page {current + 1} ·{" "}
            {status === "paused" ? "Paused" : "Listening"}
          </span>
          <button
            onClick={() => {
              if (status === "paused") {
                window.speechSynthesis.resume();
                setStatus("playing");
              } else {
                window.speechSynthesis.pause();
                setStatus("paused");
              }
            }}
          >
            {status === "paused" ? "Resume" : "Pause"}
          </button>
          <button onClick={stopSpeech}>Stop</button>
        </div>
      )}
      {!supported && (
        <p>
          Read-aloud is unavailable in this browser. Transcripts still work.
        </p>
      )}
      {supported && !voice && (
        <p>
          No {NARRATION_LANGUAGES.find(([code]) => code === language)?.[1]}{" "}
          voice is available on this device. Install a matching system voice to
          listen.
        </p>
      )}
      <p role="status" aria-live="polite">
        {message ||
          `${Object.keys(texts).length} of ${pages.length} pages prepared. Transcripts are saved locally for up to five chapter/language combinations.`}
      </p>
      <details>
        <summary>Page {current + 1} transcript · review or correct</summary>
        <textarea
          aria-label="Page narration transcript"
          maxLength={12000}
          value={currentText}
          placeholder="Prepare this page, or enter your own narration."
          onChange={(e) => {
            stopSpeech();
            saveText(current, e.target.value);
          }}
        />
        <button
          onClick={() => {
            stopSpeech();
            setSaved((old) => {
              const next = { ...old };
              delete next[group];
              return next;
            });
            setMessage("Saved chapter narration cleared.");
          }}
        >
          Clear chapter narration
        </button>
      </details>
    </section>
  );
}
