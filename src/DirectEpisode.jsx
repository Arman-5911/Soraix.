import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocal, useApp } from "./store";
import { useResource, NetworkState } from "./services/live";
import HostedPlayer from "./HostedPlayer";
import { togglePlayerFullscreen } from "./playerFullscreen";

const audioLabel = (value) =>
  value === "hi"
    ? "Hindi DUB"
    : value === "dub"
      ? "English DUB"
      : value.toUpperCase();

export default function DirectEpisode({
  anime,
  episode,
  onNext,
  fullscreenRef,
  initialPlayback,
}) {
  const languages = episode.media.availableLanguages || ["sub"];
  const [params, setParams] = useSearchParams();
  const [preferred, setPreferred] = useLocal("audio-version", "sub");
  const requested = params.get("audio") || preferred;
  const language = ["sub", "dub", "hi"].includes(requested) ? requested : "sub";
  const available = languages.includes(language);
  const [selectedServer, setServer] = useState(null);
  const { saveProgress } = useApp();
  const [autoNext] = useLocal("auto-next", true);
  const frame = useRef(null),
    readyServer = useRef(null),
    subTried = useRef(new Set()),
    lastSaved = useRef(0),
    ended = useRef(false);
  const fallbackUsed = useRef(new Set());
  const [fallbackNotice, setFallbackNotice] = useState(null);
  const [backupsExhausted, setBackupsExhausted] = useState(false);
  const [allowExternalAds, setAllowExternalAds] = useState(true);
  const serverKey = `${anime.id}-${episode.number}-${language}`;
  const embedded =
    selectedServer?.key === serverKey ? selectedServer.url : null;
  const supportsAdMode =
    embedded &&
    (() => {
      try {
        return ["filesforever.link", "desidubanime.p2pplay.pro"].includes(
          new URL(embedded).hostname,
        );
      } catch {
        return false;
      }
    })();
  const controller = useRef(null),
    switching = useRef(null);
  const live = useResource(
    available
      ? `/stream/${anime.id}/${episode.number}?language=${language}`
      : null,
    { refreshOnFocus: false },
  );
  const fallback = useCallback(
    (advance = false) => {
      const server = live.data?.media?.servers?.find(
        (s) =>
          language !== "sub" || !subTried.current.has(`${serverKey}:${s.url}`),
      );
      if (language === "sub" && advance && !server) {
        setBackupsExhausted(true);
        return;
      }
      if (
        !["sub", "hi", "dub"].includes(language) ||
        !server ||
        (embedded && !advance) ||
        fallbackUsed.current.has(serverKey)
      )
        return;
      if (language === "sub")
        subTried.current.add(`${serverKey}:${server.url}`);
      else fallbackUsed.current.add(serverKey);
      switching.current = controller.current?.snapshot() || switching.current;
      setBackupsExhausted(false);
      setServer({ key: serverKey, url: server.url });
      setFallbackNotice({ key: serverKey, name: server.name });
    },
    [language, live.data, embedded, serverKey],
  );
  useEffect(() => {
    if (
      !live.loading &&
      !live.error &&
      live.data &&
      !live.data.media?.sources?.length
    )
      fallback();
  }, [live.loading, live.error, live.data, fallback]);
  const selectServer = (url) => {
    setBackupsExhausted(false);
    fallbackUsed.current.add(serverKey);
    setFallbackNotice(null);
    setServer(url === "native" ? null : { key: serverKey, url });
  };
  useEffect(() => {
    if (!embedded || new URL(embedded).origin !== "https://ani.pm") return;
    let resumed = false;
    const timer =
      readyServer.current === embedded
        ? null
        : window.setTimeout(() => fallback(true), 25000);
    const receive = (event) => {
      if (
        event.origin !== "https://ani.pm" ||
        event.source !== frame.current?.contentWindow ||
        event.data?.ns !== "anipm.player" ||
        event.data?.v !== 1
      )
        return;
      const { event: name, data } = event.data;
      if (["ready", "playing", "timeupdate", "ended", "error"].includes(name)) {
        readyServer.current = embedded;
        window.clearTimeout(timer);
      }
      if (name === "ready" && !resumed && switching.current?.position > 0) {
        resumed = true;
        frame.current?.contentWindow?.postMessage(
          {
            ns: "anipm.player",
            v: 1,
            cmd: "seek",
            args: { time: switching.current.position },
          },
          "https://ani.pm",
        );
      }
      if (name === "error") fallback(true);
      if (
        name === "timeupdate" &&
        Number.isFinite(data?.currentTime) &&
        Number.isFinite(data?.duration) &&
        data.duration > 0
      ) {
        switching.current = {
          position: Math.max(0, data.currentTime),
          playing: !data.paused,
        };
        if (Date.now() - lastSaved.current > 5000) {
          lastSaved.current = Date.now();
          saveProgress({
            id: anime.id,
            episode: episode.number,
            position: data.currentTime,
            duration: data.duration,
            timestamp: Date.now(),
            source: "external",
            audio: language,
          });
        }
      }
      if (name === "ended" && autoNext && onNext && !ended.current) {
        ended.current = true;
        onNext();
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
    };
  }, [
    embedded,
    fallback,
    anime.id,
    episode.number,
    language,
    autoNext,
    onNext,
    saveProgress,
  ]);
  const choose = (lang) => {
    switching.current = controller.current?.snapshot() || null;
    setPreferred(lang);
    setParams(
      (old) => {
        const next = new URLSearchParams(old);
        next.set("audio", lang);
        return next;
      },
      { replace: true },
    );
  };
  return (
    <>
      <div className="stream-toolbar">
        <div>
          <span className="eyebrow">SORAIX PLAYER</span>
          <strong>Episode {episode.number}</strong>
        </div>
        <div className="audio-options" role="group" aria-label="Audio version">
          {["sub", "dub", "hi"].map((lang) => (
            <button
              key={lang}
              className={language === lang ? "active" : ""}
              aria-pressed={language === lang}
              disabled={!languages.includes(lang)}
              title={
                languages.includes(lang)
                  ? audioLabel(lang)
                  : `${audioLabel(lang)} unavailable for this episode`
              }
              onClick={() => choose(lang)}
            >
              {audioLabel(lang)}
            </button>
          ))}
        </div>
      </div>
      {!!live.data?.media?.servers?.length && (
        <div className="stream-toolbar">
          <label>
            Playback server{" "}
            <select
              aria-label={language === "sub" ? "SUB server" : "Dub server"}
              value={embedded || "native"}
              onChange={(e) => selectServer(e.target.value)}
            >
              <option value="native">SoraiX native player</option>
              {live.data.media.servers.map((s) => (
                <option key={s.url} value={s.url}>
                  {s.name} · external player
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {fallbackNotice?.key === serverKey && embedded && (
        <p className="stream-credit" role="status">
          Playback could not load. Switched to {fallbackNotice.name} for{" "}
          {audioLabel(language)}.
        </p>
      )}
      {embedded &&
      live.data?.media?.servers?.some((s) => s.url === embedded) ? (
        <div className="external-player-shell">
          <button
            className="external-fullscreen-button"
            onClick={() => togglePlayerFullscreen(fullscreenRef?.current)}
          >
            Fullscreen external player
          </button>
          {supportsAdMode && (
            <div className="stream-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={allowExternalAds}
                  onChange={(e) => setAllowExternalAds(e.target.checked)}
                />{" "}
                Allow external-player ads and pop-ups
              </label>
              <button onClick={() => selectServer("native")}>
                Use SoraiX native player
              </button>
            </div>
          )}
          <iframe
            ref={frame}
            key={`${embedded}-${!!supportsAdMode && allowExternalAds}`}
            title={
              language === "sub" ? "SUB episode player" : "Dub episode player"
            }
            src={embedded}
            onLoad={() => {
              if (new URL(embedded).origin !== "https://ani.pm") return;
              const send = (cmd, args = {}) =>
                frame.current?.contentWindow?.postMessage(
                  { ns: "anipm.player", v: 1, cmd, args },
                  "https://ani.pm",
                );
              send("hello");
              if (switching.current?.position > 0)
                send("seek", { time: switching.current.position });
            }}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            sandbox={
              supportsAdMode && allowExternalAds
                ? undefined
                : "allow-scripts allow-same-origin allow-forms allow-presentation"
            }
            style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
          />
          {language === "sub" && (
            <button
              className="button secondary small"
              onClick={() => {
                fallbackUsed.current.delete(serverKey);
                if (embedded) subTried.current.add(`${serverKey}:${embedded}`);
                fallback(true);
              }}
              disabled={
                !live.data.media.servers.some(
                  (s) =>
                    s.url !== embedded &&
                    !subTried.current.has(`${serverKey}:${s.url}`),
                )
              }
            >
              Try next SUB server
            </button>
          )}
          {backupsExhausted && language === "sub" && (
            <p className="stream-credit" role="status">
              Available SUB backups could not load. Try again later or choose a
              server manually.
            </p>
          )}
          <p className="stream-credit">
            {language === "dub" &&
              "For multi-audio servers, select English in the external player's audio menu. "}
            {supportsAdMode && allowExternalAds
              ? "Ads and pop-ups from this external player are allowed. If its AdBlock message remains, allow ads for the player in your browser or extension and reload it."
              : "This external player may require ads or reject sandbox protection."}{" "}
            {new URL(embedded).origin === "https://ani.pm"
              ? " Ani.pm supports progress saving and auto-next on SoraiX. External provider advertising may change."
              : " External playback progress is not saved by SoraiX."}
            {["sub", "dub"].includes(language) &&
              " For subtitles, use this external player's CC menu. SoraiX subtitle files and sync controls are available in the native player."}
          </p>
        </div>
      ) : !available ? (
        <div className="stream-loading audio-unavailable" role="status">
          <div>
            <h3>{audioLabel(language)} is unavailable for this episode</h3>
            <p>
              Your audio preference is saved. Choose an available version to
              continue.
            </p>
            {languages.map((lang) => (
              <button
                className="button primary small"
                key={lang}
                onClick={() => choose(lang)}
              >
                Watch {audioLabel(lang)}
              </button>
            ))}
          </div>
        </div>
      ) : live.loading || !live.data || live.error ? (
        <div className="stream-loading">
          <NetworkState resource={live} />
        </div>
      ) : !live.data.media.sources?.length ? (
        <div className="stream-loading" role="status">
          Direct playback is unavailable.{" "}
          <button onClick={live.retry}>Retry</button>
        </div>
      ) : (
        <HostedPlayer
          key={`${episode.key}-${language}-${live.data.resolvedAt}`}
          controllerRef={controller}
          initialPlayback={switching.current || initialPlayback}
          fullscreenRef={fullscreenRef}
          anime={anime}
          episode={{
            ...episode,
            media: { ...live.data.media, audio: language },
          }}
          onNext={onNext}
          onPlaybackFailure={fallback}
          onRetry={() => {
            switching.current = controller.current?.snapshot() || null;
            live.retry();
          }}
        />
      )}
      <p className="stream-credit">
        {available
          ? `${audioLabel(language)} · Source: ${live.data?.provider || "Loading"}`
          : "Audio availability varies by episode"}{" "}
        · Playback stays on SoraiX
      </p>
    </>
  );
}
