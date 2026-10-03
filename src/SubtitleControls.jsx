import React, { useEffect, useRef, useState } from "react";
import { Captions, X } from "lucide-react";
import { subtitleToVtt } from "./subtitles";

export default function SubtitleControls({ video, animeId, episode, audio }) {
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(-1);
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const added = useRef([]),
    preference = useRef(null),
    originals = useRef(new WeakMap());
  const request = useRef(null);
  useEffect(() => {
    if (audio !== "dub") return;
    const timer = setTimeout(() => {
      if (video.current && !Array.from(video.current.textTracks).some(t => ["subtitles", "captions"].includes(t.kind)))
        findSubtitles();
    }, 1800);
    return () => clearTimeout(timer);
  }, [animeId, episode, audio]);
  useEffect(() => {
    const v = video.current;
    const refresh = (auto = false) => {
      const list = Array.from(v.textTracks).filter((t) =>
        ["subtitles", "captions"].includes(t.kind),
      );
      if (
        auto && preference.current === null &&
        !list.some((t) => t.mode === "showing")
      ) {
        const english = list.find(
          (t) => /^en(?:-|$)/i.test(t.language) || /english/i.test(t.label),
        );
        if (english) english.mode = "showing";
      }
      setTracks(list);
      setSelected(list.findIndex((t) => t.mode === "showing"));
    };
    const addedTrack = () => refresh(true);
    const changedTrack = () => refresh(false);
    refresh(true);
    v.textTracks.addEventListener("addtrack", addedTrack);
    v.textTracks.addEventListener("removetrack", changedTrack);
    v.textTracks.addEventListener("change", changedTrack);
    return () => {
      request.current?.abort();
      v.textTracks.removeEventListener("addtrack", addedTrack);
      v.textTracks.removeEventListener("removetrack", changedTrack);
      v.textTracks.removeEventListener("change", changedTrack);
      for (const { element, url } of added.current) {
        element.remove();
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
    };
  }, [video]);
  const select = (index) => {
    preference.current = index;
    for (const t of tracks)
      for (const cue of t.cues || []) {
        const original = originals.current.get(cue);
        if (original) {
          cue.startTime = original[0];
          cue.endTime = original[1];
        }
      }
    tracks.forEach((t, i) => {
      t.mode = i === index ? "showing" : "disabled";
    });
    setSelected(index);
    setOffset(0);
  };
  const addTrack = (url, label, language = "en") => {
    const element = document.createElement("track");
    element.kind = "subtitles";
    element.label = label;
    element.srclang = language;
    element.src = url;
    element.addEventListener("error", () =>
      setMessage("Subtitles could not load. Try a local SRT/VTT file."),
    );
    element.addEventListener("load", () => {
      for (const t of video.current?.textTracks || [])
        t.mode = t === element.track ? "showing" : "disabled";
      setMessage("Subtitles loaded. Adjust sync below if needed.");
      setOffset(0);
    });
    added.current.push({ element, url });
    video.current.append(element);
    element.track.mode = "hidden";
    preference.current = "custom";
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Subtitle file must be smaller than 2 MB.");
      if (!/\.(srt|vtt)$/i.test(file.name))
        throw new Error("Choose an SRT or VTT subtitle file.");
      const text = subtitleToVtt(await file.text());
      addTrack(
        URL.createObjectURL(new Blob([text], { type: "text/vtt" })),
        file.name,
      );
    } catch (error) {
      setMessage(error.message);
    }
  };
  const findSubtitles = async () => {
    request.current?.abort();
    setSearching(true);
    setMessage("");
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`/api/subtitles/${animeId}/${episode}`, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "Subtitle source is unavailable. You can load an SRT/VTT file.",
        );
      const data = await response.json();
      const caption = data.captions?.find((c) =>
        /^en(?:-|$)/i.test(c.language),
      );
      if (!caption)
        setMessage(
          "No English subtitle file was found for this episode. You can load your own SRT/VTT.",
        );
      else
        addTrack(
          caption.url,
          audio === "dub" ? "English (SUB translation)" : caption.label,
          "en",
        );
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error.message);
      else
        setMessage(
          "Subtitle lookup timed out. Try again or load a subtitle file.",
        );
    } finally {
      clearTimeout(timer);
      setSearching(false);
    }
  };
  const sync = (seconds) => {
    setOffset(seconds);
    for (const cue of tracks[selected]?.cues || []) {
      if (!originals.current.has(cue))
        originals.current.set(cue, [cue.startTime, cue.endTime]);
      const [start, end] = originals.current.get(cue);
      cue.startTime = Math.max(0, start + seconds);
      cue.endTime = Math.max(0.001, end + seconds);
    }
  };
  return (
    <div className="subtitle-tools">
      <button
        className="subtitle-toggle"
        aria-label="Subtitle settings"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Captions size={20} />
      </button>
      {open && (
        <section
          className="subtitle-panel"
          aria-label="Subtitle settings panel"
        >
          <div className="subtitle-heading">
            <strong>Subtitles</strong>
            <button
              aria-label="Close subtitle settings"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <label>
            Caption track
            <select
              aria-label="Caption track"
              value={selected}
              onChange={(e) => select(Number(e.target.value))}
            >
              <option value={-1}>Off</option>
              {tracks.map((t, i) => (
                <option key={i} value={i}>
                  {t.label || t.language || `Track ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          {!tracks.length && (
            <p>
              No separate subtitle track supplied. The video may have embedded
              subtitles.
            </p>
          )}
          <button disabled={searching} onClick={findSubtitles}>
            {searching ? "Looking for subtitles…" : "Find English subtitles"}
          </button>
          <label className="subtitle-upload">
            Load SRT / VTT
            <input
              type="file"
              accept=".srt,.vtt"
              aria-label="Load subtitle file"
              onChange={upload}
            />
          </label>
          <label>
            Subtitle delay (seconds)
            <input
              type="number"
              aria-label="Subtitle delay"
              min={-30}
              max={30}
              step={0.5}
              value={offset}
              disabled={selected < 0}
              onChange={(e) =>
                sync(Math.max(-30, Math.min(30, Number(e.target.value) || 0)))
              }
            />
          </label>
          {audio === "dub" && (
            <p>
              SUB translations may differ from English dialogue. Use delay to
              adjust timing.
            </p>
          )}
          <p>Local files stay in this browser session.</p>
          {message && <p role="status">{message}</p>}
        </section>
      )}
    </div>
  );
}
