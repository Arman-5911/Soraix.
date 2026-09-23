import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize,
  PictureInPicture2,
} from "lucide-react";
import { useApp, useLocal } from "./store";
import { IconButton } from "./components";
export default function HostedPlayer({ anime, episode, onNext, onRetry }) {
  const { history, saveProgress, notify } = useApp();
  const video = useRef(null),
    savedAt = useRef(0),
    resume = useRef(
      history.find((h) => h.id === anime.id && h.episode === episode.number)
        ?.position || 0,
    );
  const [source, setSource] = useState(0),
    [error, setError] = useState(false),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const hls = useRef(null);
  const [levels, setLevels] = useState([]),
    [quality, setQuality] = useState(-1),
    [attempt, setAttempt] = useState(0);
  const [autoplay, setAutoplay] = useLocal("autoplay", false),
    [autoNext, setAutoNext] = useLocal("auto-next", false),
    [skipIntro, setSkipIntro] = useLocal("skip-intro", false);
  const media = episode.media;
  const persist = (v) => {
    if (v && Number.isFinite(v.duration) && v.duration > 0)
      saveProgress({
        id: anime.id,
        episode: episode.number,
        position: v.currentTime,
        duration: v.duration,
        timestamp: Date.now(),
        source: media.provider === "direct" ? "direct" : "hosted",
      });
  };
  const play = () => {
    if (video.current?.paused)
      video.current
        .play()
        .catch(() => notify("Playback could not start. Try again."));
    else video.current?.pause();
  };
  const seek = (delta) => {
    const v = video.current;
    if (v && Number.isFinite(v.duration))
      v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  };
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else
      video.current
        ?.requestFullscreen?.()
        .catch(() => notify("Fullscreen is unavailable."));
  };
  useEffect(() => {
    const v = video.current,
      selected = media.sources[source];
    let disposed = false,
      instance;
    setError(false);
    setLevels([]);
    setQuality(-1);
    const connect = async () => {
      if (selected.type === "hls" || /\.m3u8(?:\?|$)/i.test(selected.url)) {
        const { default: Hls } = await import("hls.js");
        if (disposed) return;
        if (Hls.isSupported()) {
          instance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
          hls.current = instance;
          instance.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!disposed)
              setLevels(
                instance.levels.map((l, index) => ({
                  index,
                  label: l.height
                    ? `${l.height}p`
                    : `${Math.round(l.bitrate / 1000)} kbps`,
                })),
              );
          });
          instance.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal && !disposed) setError(true);
          });
          instance.loadSource(selected.url);
          instance.attachMedia(v);
        } else if (v.canPlayType("application/vnd.apple.mpegurl"))
          v.src = selected.url;
        else setError(true);
      } else v.src = selected.url;
    };
    connect().catch(() => {
      if (!disposed) setError(true);
    });
    return () => {
      disposed = true;
      persist(v);
      instance?.destroy();
      hls.current = null;
      v.removeAttribute("src");
      v.load();
    };
  }, [media.sources[source]?.url, source, attempt]);
  useEffect(() => {
    const v = video.current;
    const save = () => persist(v);
    const key = (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName) ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      const k = e.key.toLowerCase();
      if (
        [
          " ",
          "arrowleft",
          "arrowright",
          "arrowup",
          "arrowdown",
          "f",
          "m",
        ].includes(k)
      )
        e.preventDefault();
      if (k === " ") play();
      if (k === "arrowleft") seek(-10);
      if (k === "arrowright") seek(10);
      if (k === "arrowup") v.volume = Math.min(1, v.volume + 0.1);
      if (k === "arrowdown") v.volume = Math.max(0, v.volume - 0.1);
      if (k === "m") v.muted = !v.muted;
      if (k === "f") fullscreen();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("keydown", key);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <>
      <div className="video-player hosted-player">
        <video
          ref={video}
          controls
          crossOrigin="anonymous"
          playsInline
          preload="metadata"
          poster={anime.banner || anime.poster}
          onLoadedMetadata={() => {
            const v = video.current;
            v.currentTime =
              resume.current >= v.duration - 5
                ? 0
                : Math.min(resume.current, Math.max(0, v.duration - 1));
            v.playbackRate = speed;
            if (autoplay) v.play().catch(() => {});
          }}
          onError={() => setError(true)}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            persist(video.current);
          }}
          onTimeUpdate={() => {
            const v = video.current;
            if (
              skipIntro &&
              media.introEnd > v.currentTime &&
              media.introEnd < v.duration &&
              v.currentTime > 0
            )
              v.currentTime = media.introEnd;
            if (Math.abs(v.currentTime - savedAt.current) > 5) {
              persist(v);
              savedAt.current = v.currentTime;
            }
          }}
          onEnded={() => {
            persist(video.current);
            if (autoNext && onNext) onNext();
          }}
        >
          {(media.captions || []).map((c, index) => (
            <track
              key={c.url}
              kind="captions"
              src={c.url}
              srcLang={c.language}
              label={c.label}
              default={
                c.language === "en" &&
                !media.captions.slice(0, index).some((t) => t.language === "en")
              }
            />
          ))}
        </video>
        {error && (
          <div className="player-message">
            <h3>This stream couldn’t load.</h3>
            <p>
              The source may be temporarily unavailable. Retry to request a
              fresh stream.
            </p>
            <button
              className="button primary small"
              onClick={() => {
                setError(false);
                resume.current = video.current?.currentTime || resume.current;
                if (onRetry) onRetry();
                else setAttempt((v) => v + 1);
              }}
            >
              Retry playback
            </button>
          </div>
        )}
      </div>
      <div className="hosted-controls">
        <IconButton label={playing ? "Pause" : "Play"} onClick={play}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </IconButton>
        <IconButton label="Rewind 10 seconds" onClick={() => seek(-10)}>
          <RotateCcw size={18} />
        </IconButton>
        <IconButton label="Forward 10 seconds" onClick={() => seek(10)}>
          <RotateCw size={18} />
        </IconButton>
        <select
          aria-label="Video source and quality"
          value={source}
          onChange={(e) => {
            resume.current = video.current.currentTime;
            setError(false);
            setSource(Number(e.target.value));
          }}
        >
          {media.sources.map((s, i) => (
            <option value={i} key={s.url}>
              {s.quality} · {s.language}
            </option>
          ))}
        </select>
        {!!levels.length && (
          <select
            aria-label="Streaming quality"
            value={quality}
            onChange={(e) => {
              const next = Number(e.target.value);
              setQuality(next);
              if (hls.current) hls.current.currentLevel = next;
            }}
          >
            <option value={-1}>Auto quality</option>
            {levels.map((l) => (
              <option key={l.index} value={l.index}>
                {l.label}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(e) => {
            setSpeed(Number(e.target.value));
            video.current.playbackRate = Number(e.target.value);
          }}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
            <option value={n} key={n}>
              {n}×
            </option>
          ))}
        </select>
        <IconButton
          label="Picture in picture"
          onClick={async () => {
            try {
              if (document.pictureInPictureElement)
                await document.exitPictureInPicture();
              else await video.current.requestPictureInPicture();
            } catch {
              notify("Picture in picture is unavailable.");
            }
          }}
        >
          <PictureInPicture2 size={18} />
        </IconButton>
        <IconButton label="Fullscreen" onClick={fullscreen}>
          <Maximize size={18} />
        </IconButton>
      </div>
      <div className="player-options">
        <label>
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(e) => setAutoplay(e.target.checked)}
          />{" "}
          Autoplay
        </label>
        {onNext && (
          <label>
            <input
              type="checkbox"
              checked={autoNext}
              onChange={(e) => setAutoNext(e.target.checked)}
            />{" "}
            Auto next
          </label>
        )}
        {media.introEnd > 0 && (
          <label>
            <input
              type="checkbox"
              checked={skipIntro}
              onChange={(e) => setSkipIntro(e.target.checked)}
            />{" "}
            Skip intro
          </label>
        )}
      </div>
      <div className="keyboard-hints">
        <span>
          <kbd>Space</kbd> Play / Pause
        </span>
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd> Seek 10s
        </span>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> Volume
        </span>
        <span>
          <kbd>M</kbd> Mute
        </span>
        <span>
          <kbd>F</kbd> Fullscreen
        </span>
      </div>
    </>
  );
}
