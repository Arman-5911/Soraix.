import React from "react";
import { useApp } from "./store";
export const THEMES = [
  ["glass", "Liquid Night"],
  ["midnight", "Midnight black"],
  ["dim", "Soft charcoal"],
];
export default function ThemePicker() {
  const { theme, setTheme } = useApp();
  return (
    <label className="theme-picker">
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
    </label>
  );
}
