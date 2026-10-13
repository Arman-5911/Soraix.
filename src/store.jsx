import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { persistTitle } from "./services/catalog";
import PearlPalette, { PEARL_PALETTES } from "./PearlPalette";
const Context = createContext(null);
export function readStore(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem("soraix-" + key));
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
export function useLocal(key, initial) {
  const [value, setValue] = useState(() => {
    let v = readStore(key, initial);
    if (key === "history" && Array.isArray(v))
      v = v.filter((h) => ["hosted", "direct", "youtube"].includes(h?.source));
    return Array.isArray(initial)
      ? Array.isArray(v)
        ? v
        : initial
      : typeof v === typeof initial
        ? v
        : initial;
  });
  const current = useRef(value);
  const update = useCallback(
    (next) => {
      const resolved =
        typeof next === "function" ? next(current.current) : next;
      current.current = resolved;
      try {
        localStorage.setItem("soraix-" + key, JSON.stringify(resolved));
      } catch {}
      setValue(resolved);
    },
    [key],
  );
  return [value, update];
}
export function AppProvider({ children }) {
  const [language, setLanguage] = useLocal("language", "EN"),
    [watchlist, setWatchlist] = useLocal("watchlist", []),
    [history, setHistory] = useLocal("history", []),
    [recent, setRecent] = useLocal("searches", []),
    [theme, setStoredTheme] = useLocal("theme", "glass"),
    [storedPearlPalette, setPearlPalette] = useLocal("pearl-palette", "default"),
    [paletteOpen, setPaletteOpen] = useState(false),
    [toast, setToast] = useState("");
  const pearlPalette = PEARL_PALETTES.some(([id]) => id === storedPearlPalette)
    ? storedPearlPalette : "default";
  const closePearlPalette = useCallback(() => setPaletteOpen(false), []);
  const openPearlPalette = useCallback(() => setPaletteOpen(true), []);
  const choosePearlPalette = useCallback((next) => {
    setPearlPalette(next);
    setPaletteOpen(false);
  }, [setPearlPalette]);
  const setTheme = useCallback((next) => {
    setStoredTheme(next);
    setPaletteOpen(next === "pearl");
  }, [setStoredTheme]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3200);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.pearlPalette = pearlPalette;
  }, [pearlPalette]);
  const notify = useCallback((message) => setToast(message), []);
  const toggleWatchlist = useCallback((id) => {
    persistTitle(id);
    const exists = watchlist.includes(id);
    setWatchlist((v) => (exists ? v.filter((x) => x !== id) : [...v, id]));
    notify(
      exists ? "Removed from your watchlist" : "Added to your SoraiX Watchlist",
    );
  }, [watchlist, setWatchlist, notify]);
  const saveProgress = useCallback((entry) => {
    persistTitle(entry.id);
    setHistory((h) =>
      [entry, ...h.filter((x) => x.id !== entry.id)].slice(0, 100),
    );
  }, [setHistory]);
  const title = useCallback((a) =>
    a?.title?.[language === "JP" ? "romaji" : "english"] || "Unknown title", [language]);
  const contextValue = useMemo(() => ({
    language, setLanguage, watchlist, setWatchlist, history, setHistory,
    recent, setRecent, theme, setTheme, pearlPalette, openPearlPalette,
    notify, toggleWatchlist,
    saveProgress, title,
  }), [language, setLanguage, watchlist, setWatchlist, history, setHistory,
    recent, setRecent, theme, setTheme, pearlPalette, openPearlPalette,
    notify, toggleWatchlist, saveProgress, title]);
  return (
    <Context.Provider
      value={contextValue}
    >
      {children}
      {theme === "pearl" && paletteOpen && (
        <PearlPalette value={pearlPalette} onChange={choosePearlPalette}
          onClose={closePearlPalette} />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
