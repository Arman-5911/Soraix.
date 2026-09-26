import React, { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocal } from "./store";
import { useResource, NetworkState } from "./services/live";
import HostedPlayer from "./HostedPlayer";

const audioLabel = (value) =>
  value === "hi" ? "Hindi DUB" : value.toUpperCase();

export default function DirectEpisode({ anime, episode, onNext }) {
  const languages = episode.media.availableLanguages || ["sub"];
  const [params, setParams] = useSearchParams();
  const [preferred, setPreferred] = useLocal("audio-version", "sub");
  const requested = params.get("audio") || preferred;
  const language = ["sub", "dub", "hi"].includes(requested) ? requested : "sub";
  const available = languages.includes(language);
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
      {!available ? (
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
      ) : (
        <HostedPlayer
          key={`${episode.key}-${language}-${live.data.resolvedAt}`}
          controllerRef={controller}
          initialPlayback={switching.current}
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
