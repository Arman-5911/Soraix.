import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { persistTitle } from "./services/catalog";
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
    [theme, setTheme] = useLocal("theme", "midnight"),
    [toast, setToast] = useState("");
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3200);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const notify = (message) => setToast(message);
  const toggleWatchlist = (id) => {
    persistTitle(id);
    const exists = watchlist.includes(id);
    setWatchlist((v) => (exists ? v.filter((x) => x !== id) : [...v, id]));
    notify(
      exists ? "Removed from your watchlist" : "Added to your SoraiX Watchlist",
    );
  };
  const saveProgress = (entry) => {
    persistTitle(entry.id);
    setHistory((h) =>
      [entry, ...h.filter((x) => x.id !== entry.id)].slice(0, 100),
    );
  };
  const title = (a) =>
    a?.title?.[language === "JP" ? "romaji" : "english"] || "Unknown title";
  return (
    <Context.Provider
      value={{
        language,
        setLanguage,
        watchlist,
        setWatchlist,
        history,
        setHistory,
        recent,
        setRecent,
        theme,
        setTheme,
        notify,
        toggleWatchlist,
        saveProgress,
        title,
      }}
    >
      {children}
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
