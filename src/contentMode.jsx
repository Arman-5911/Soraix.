import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLocal } from "./store";
import { READ_LISTEN_ENABLED } from "./features";
import { ReadListenNotice } from "./ComingSoon";
import "./universe.css";
export const MODES = ["anime", "manga", "manhwa", "manhua", "donghua"];
const MODE_ICONS = {
  anime: "🎬",
  manga: "📖",
  manhwa: "📱",
  manhua: "🖌️",
  donghua: "🐉",
};
const Context = createContext(null);
const label = (s) => s[0].toUpperCase() + s.slice(1);
export const modeBrand = (mode) => `SoraiX ${label(mode)}`;
export function UniverseProvider({ children }) {
  const [saved, setMode] = useLocal("content-mode", "anime");
  const [library, setLibrary] = useLocal("reading-library", []);
  const [history, setHistory] = useLocal("reading-history", []);
  const mode = MODES.includes(saved) ? saved : "anime";
  useEffect(() => {
    document.documentElement.dataset.contentMode = mode;
  }, [mode]);
  const toggle = (item) =>
    setLibrary((old) =>
      old.some((a) => a.anilistId === item.anilistId)
        ? old.filter((a) => a.anilistId !== item.anilistId)
        : [{ ...item }, ...old],
    );
  const record = (item, chapter, page, total, language) =>
    setHistory((old) =>
      [
        { item, chapter, page, total, language, updatedAt: Date.now() },
        ...old.filter((a) => a.item.anilistId !== item.anilistId),
      ].slice(0, 200),
    );
  return (
    <Context.Provider
      value={{ mode, setMode, library, toggle, history, record }}
    >
      {children}
    </Context.Provider>
  );
}
export const useUniverse = () => useContext(Context);
export function ModeSwitcher() {
  const [notice, setNotice] = useState(false);
  const { mode, setMode } = useUniverse();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="mode-switcher">
      <select
        aria-label="Content mode"
        value={
          READ_LISTEN_ENABLED &&
          (location.pathname === "/read-listen" ||
            new URLSearchParams(location.search).get("listen") === "1")
            ? "listen"
            : mode
        }
        onChange={(e) => {
          if (e.target.value === "listen") {
            if (!READ_LISTEN_ENABLED) {
              setNotice(true);
              return;
            }
            navigate("/read-listen");
            return;
          }
          setMode(e.target.value);
          navigate("/");
        }}
      >
        {MODES.map((m) => (
          <option key={m} value={m}>
            {MODE_ICONS[m]} {label(m)}
          </option>
        ))}
        <option value="listen">
          🎧 Read &amp; Listen{!READ_LISTEN_ENABLED ? " · Soon" : ""}
        </option>
      </select>
      {notice && <ReadListenNotice onClose={() => setNotice(false)} />}
    </div>
  );
}
