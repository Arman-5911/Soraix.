import React, { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocal } from "./store";
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
              aria-label="Dub server"
              value={embedded || "native"}
              onChange={(e) =>
                setServer(
                  e.target.value === "native"
                    ? null
                    : { key: serverKey, url: e.target.value },
                )
              }
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
              <button onClick={() => setServer(null)}>
                Use SoraiX native player
              </button>
            </div>
          )}
          <iframe
            key={`${embedded}-${!!supportsAdMode && allowExternalAds}`}
            title="Dub episode player"
            src={embedded}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            sandbox={
              supportsAdMode && allowExternalAds
                ? undefined
                : "allow-scripts allow-same-origin allow-forms allow-presentation"
            }
            style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
          />
          <p className="stream-credit">
            {supportsAdMode && allowExternalAds
              ? "Ads and pop-ups from this external player are allowed. If its AdBlock message remains, allow ads for the player in your browser or extension and reload it."
              : "This external player may require ads or reject sandbox protection."}{" "}
            External playback progress is not saved by SoraiX.
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
