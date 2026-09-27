import React, { useCallback, useEffect, useState } from "react";
import { hydrate, remember } from "./catalog";
const cache = new Map(),
  pending = new Map();
export async function request(path, { force = false } = {}) {
  const old = cache.get(path);
  if (!force && old && Date.now() - old.time < 60_000) return old.data;
  if (pending.has(path)) return pending.get(path);
  const job = (async () => {
    let res;
    try {
      res = await fetch("/api" + path, { signal: AbortSignal.timeout(35_000) });
    } catch {
      throw new Error(
        "Unable to reach the live catalogue. Check your connection and retry.",
      );
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(
        "The server returned an invalid response. Please retry; if this persists, the deployment API routes need checking.",
      );
    }
    if (!res.ok) {
      const error = new Error(
        data.error || "The live catalogue is temporarily unavailable.",
      );
      error.status = res.status;
      throw error;
    }
    if (data.anime && data.recommendations) {
      data.anime = {
        ...data.anime,
        details: true,
        recommendations: data.recommendations,
        related: data.related,
      };
    }
    if (!/^\/(universe|chapters|pages|readable)(\/|\?)/.test(path)) hydrate(data);
    cache.set(path, { data, time: Date.now() });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return data;
  })();
  pending.set(path, job);
  try {
    return await job;
  } finally {
    pending.delete(path);
  }
}
export function useResource(
  path,
  { interval = 0, refreshOnFocus = true } = {},
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    path,
    data: cache.get(path)?.data,
    error: null,
    loading: !!path && !cache.has(path),
  });
  const retry = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    if (!path) {
      setState({ path, data: null, error: null, loading: false });
      return;
    }
    const load = async (force = false) => {
      setState((s) => ({
        path,
        data: s.path === path ? s.data : cache.get(path)?.data,
        error: null,
        loading: !cache.has(path),
      }));
      try {
        const data = await request(path, { force });
        if (active) setState({ path, data, error: null, loading: false });
      } catch (error) {
        if (active)
          setState((s) => ({
            path,
            data: s.path === path ? s.data : null,
            error,
            loading: false,
          }));
      }
    };
    load(revision > 0);
    const onFocus = () => {
      if (!document.hidden) load();
    };
    if (refreshOnFocus) window.addEventListener("focus", onFocus);
    const timer = interval
      ? setInterval(() => {
          if (!document.hidden) load(true);
        }, interval)
      : null;
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [path, revision, interval, refreshOnFocus]);
  return {
    ...(state.path === path
      ? state
      : { path, data: cache.get(path)?.data, error: null, loading: !!path }),
    retry,
  };
}
export function useAnime(slug) {
  return useResource(slug ? "/anime/" + encodeURIComponent(slug) : null);
}
export function useSavedTitles(ids) {
  const key = JSON.stringify(ids);
  const [state, setState] = useState({ loading: false, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const list = JSON.parse(key);
    if (!list.length) {
      setState({ loading: false, error: null });
      return;
    }
    setState({ loading: true, error: null });
    (async () => {
      for (const id of list) {
        try {
          await request("/anime/" + encodeURIComponent(id));
        } catch (error) {
          if (active) setState({ loading: false, error });
          return;
        }
      }
      if (active) setState({ loading: false, error: null });
    })();
    return () => {
      active = false;
    };
  }, [key, revision]);
  return { ...state, retry: () => setRevision((v) => v + 1) };
}
export function NetworkState({ resource, compact = false }) {
  if (resource.error)
    return (
      <div
        className={"network-state " + (compact ? "compact" : "")}
        role="alert"
      >
        <h2>
          {resource.error.status === 404
            ? "Anime not found"
            : "Couldn’t load live data"}
        </h2>
        <p>{resource.error.message}</p>
        <button className="button primary small" onClick={resource.retry}>
          Try again
        </button>
      </div>
    );
  if (resource.loading)
    return (
      <div
        className={"network-state " + (compact ? "compact" : "")}
        role="status"
      >
        <span className="eyebrow">CONNECTING YOU TO NEW WORLDS</span>
        <p>Loading the live catalogue…</p>
        <div className="network-skeletons">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      </div>
    );
  return null;
}
export function Freshness({ resource }) {
  return (
    <div className="freshness">
      <i />
      {resource.error
        ? "Live provider unavailable — retry to refresh"
        : resource.data?.fetchedAt
          ? `Live catalogue · Updated ${new Date(resource.data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Live catalogue"}
      <button onClick={resource.retry} disabled={resource.loading}>
        Refresh
      </button>
    </div>
  );
}
