import React, { useState } from "react";
import { useResource, NetworkState } from "./services/live";
import HostedPlayer from "./HostedPlayer";

export default function DirectEpisode({ anime, episode, onNext }) {
  const languages = episode.media.availableLanguages || ["sub"];
  const [language, setLanguage] = useState(languages[0]);
  const live = useResource(
    `/stream/${anime.id}/${episode.number}?language=${language}`,
    { refreshOnFocus: false },
  );
  return (
    <>
      <div className="stream-toolbar">
        <div>
          <span className="eyebrow">SORAIX PLAYER</span>
          <strong>Episode {episode.number}</strong>
        </div>
        <div className="audio-options" role="group" aria-label="Audio version">
          {["sub", "dub"].map((lang) => (
            <button
              key={lang}
              className={language === lang ? "active" : ""}
              disabled={!languages.includes(lang)}
              title={
                languages.includes(lang)
                  ? lang.toUpperCase()
                  : `${lang.toUpperCase()} unavailable from this source`
              }
              onClick={() => setLanguage(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {live.loading || !live.data || live.error ? (
        <div className="stream-loading">
          <NetworkState resource={live} />
        </div>
      ) : (
        <HostedPlayer
          key={`${episode.key}-${language}-${live.data.resolvedAt}`}
          anime={anime}
          episode={{ ...episode, media: live.data.media }}
          onNext={onNext}
          onRetry={live.retry}
        />
      )}
      <p className="stream-credit">
        Source: {live.data?.provider || "AnimeParadise"} · Playback stays on
        SoraiX
      </p>
    </>
  );
}
