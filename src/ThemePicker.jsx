import React from "react";
import { useApp } from "./store";
export const THEMES = [
  ["glass", "Liquid Glass · Dark"],
  ["pearl", "Pearl Glass · Dark"],
  ["midnight", "Midnight black"],
  ["dim", "Soft charcoal"],
];
export default function ThemePicker() {
  const { theme, setTheme, openPearlPalette } = useApp();
  return (
    <div className="theme-picker">
      <span>Appearance</span>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
      >
        {THEMES.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      {theme === "pearl" && (
        <button type="button" className="pearl-palette-trigger"
          onClick={openPearlPalette} aria-label="Change Pearl Glass background">
          Colors
        </button>
      )}
    </div>
  );
}
