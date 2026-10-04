import React from "react";
import { SkipBack, SkipForward } from "lucide-react";

export default function EpisodeControls({ onPrevious, onNext }) {
  return (
    <div
      className="player-episode-controls"
      role="group"
      aria-label="Player episode navigation"
    >
      <button
        type="button"
        disabled={!onPrevious}
        onClick={onPrevious}
        aria-label="Previous episode in player"
        title="Previous episode"
      >
        <SkipBack size={16} />
      </button>
      <button
        type="button"
        disabled={!onNext}
        onClick={onNext}
        aria-label="Next episode in player"
        title="Next episode"
      >
        <SkipForward size={16} />
      </button>
    </div>
  );
}
