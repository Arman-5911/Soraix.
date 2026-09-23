import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { useResource, NetworkState, Freshness } from "../services/live";
import { useApp } from "../store";
import { Empty, Poster, IconButton } from "../components";
export default function Schedule() {
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState((new Date().getDay() + 6) % 7);
  const { title } = useApp();
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const start = new Date(dates[selected]);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const live = useResource(
    `/schedule?from=${Math.floor(start.getTime() / 1000)}&to=${Math.floor(end.getTime() / 1000)}`,
    { interval: 60000 },
  );
  const rows = live.data?.items || [];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="page">
      <div className="page-intro">
        <span className="eyebrow">MAKE ROOM FOR YOUR FAVORITES</span>
        <h1>Your week, in anime.</h1>
        <p>Live broadcast schedule · {timezone}</p>
      </div>
      <div className="schedule-toolbar">
        <div>
          <CalendarDays size={20} />
          <h2>
            {monday.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h2>
        </div>
        <div>
          <IconButton
            label="Previous week"
            onClick={() => setOffset((v) => v - 1)}
          >
            <ChevronLeft size={19} />
          </IconButton>
          <button
            className="button secondary small"
            onClick={() => {
              setOffset(0);
              setSelected((new Date().getDay() + 6) % 7);
            }}
          >
            This week
          </button>
          <IconButton label="Next week" onClick={() => setOffset((v) => v + 1)}>
            <ChevronRight size={19} />
          </IconButton>
        </div>
      </div>
      <div className="week-tabs">
        {dates.map((d, i) => (
          <button
            className={selected === i ? "active" : ""}
            key={i}
            onClick={() => setSelected(i)}
          >
            <span>{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
            <strong>{d.getDate()}</strong>
            {d.toDateString() === new Date().toDateString() && <i />}
          </button>
        ))}
      </div>
      <p className="schedule-notice">
        Confirmed schedule entries from AniList, refreshed every minute. Times
        can change at the broadcaster.
      </p>
      <Freshness resource={live} />
      {(live.loading || live.error) && <NetworkState resource={live} />}
      <div className="schedule-list">
        {rows.map(({ anime: a, airingAt, episode, id }) => (
          <Link to={"/anime/" + a.slug} key={id}>
            <time>
              {new Date(airingAt * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
            <Poster a={a} />
            <div>
              <strong>{title(a)}</strong>
              <small>
                Episode {episode} · {a.type}
              </small>
            </div>
            <span className="status-dot">
              {airingAt * 1000 > Date.now() ? "Upcoming" : "Aired"}
            </span>
            <ArrowRight size={18} />
          </Link>
        ))}
      </div>
      {!rows.length && !live.loading && !live.error && (
        <Empty
          icon={CalendarDays}
          title="A quiet day in this universe."
          text="No confirmed broadcasts in our catalogue for this day. Explore another day or discover a new favorite."
        >
          <Link className="button primary" to="/top-airing">
            Explore airing anime
          </Link>
        </Empty>
      )}
    </div>
  );
}
