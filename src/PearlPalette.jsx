import React, { useEffect, useRef } from "react";

export const PEARL_PALETTES = [
  ["default", "Default", "Deep graphite with a cool blue glow"],
  ["aurora", "Aurora", "Blue and cyan radial light"],
  ["amethyst", "Amethyst", "Violet and indigo gradient"],
  ["ember", "Ember", "Rose and warm amber light"],
  ["jade", "Jade", "Teal and green radial glow"],
  ["prism", "Prism", "Iridescent blue, violet and rose"],
  ["tidal", "Tidal", "Deep ocean blue and turquoise"],
  ["solstice", "Solstice", "Amber, coral and plum light"],
  ["nebula", "Nebula", "Indigo, magenta and starlight"],
];

export default function PearlPalette({ value, onChange, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector('[aria-pressed="true"]')?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.current.querySelectorAll("button")];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="pearl-palette-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialog} className="pearl-palette-dialog" role="dialog"
        aria-modal="true" aria-labelledby="pearl-palette-title">
        <div className="pearl-palette-head">
          <div>
            <span className="pearl-palette-kicker">PEARL GLASS</span>
            <h2 id="pearl-palette-title">Choose your atmosphere</h2>
            <p>Pick a background glow. You can change it anytime.</p>
          </div>
          <button type="button" className="pearl-palette-close" onClick={onClose}
            aria-label="Close background colors">×</button>
        </div>
        <div className="pearl-palette-grid" role="group" aria-label="Background color">
          {PEARL_PALETTES.map(([id, name, description]) => (
            <button type="button" key={id} className="pearl-palette-option"
              data-palette={id} aria-pressed={value === id}
              onClick={() => onChange(id)}>
              <span className="pearl-palette-swatch" aria-hidden="true" />
              <span className="pearl-palette-name">{name}</span>
              <span className="pearl-palette-description">{description}</span>
            </button>
          ))}
        </div>
        <button type="button" className="pearl-palette-done" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}
