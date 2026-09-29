import React from "react";
import { Link } from "react-router-dom";
import { Bookmark, History, Compass, ArrowUpRight } from "lucide-react";
import { useApp } from "./store";
import { useUniverse } from "./universe";
export default function GlassWidgets() {
  const { theme, watchlist, history } = useApp();
  const reading = useUniverse();
  if (theme !== "glass") return null;
  const books = ["manga", "manhwa", "manhua"].includes(reading.mode);
  const saved = books
    ? reading.library.filter((x) => x.mode === reading.mode).length
    : watchlist.length;
  const recent = books
    ? reading.history.filter((x) => x.item.mode === reading.mode).length
    : history.length;
  return (
    <section className="glass-widgets" aria-label="Your space">
      <Link to="/watchlist" className="glass-widget">
        <span className="glass-app-icon">
          <Bookmark size={22} />
        </span>
        <div>
          <small>YOUR COLLECTION</small>
          <strong>
            {saved} saved {books ? "stories" : "titles"}
          </strong>
          <span>Everything you love, together.</span>
        </div>
        <ArrowUpRight className="widget-arrow" size={18} />
      </Link>
      <Link to="/history" className="glass-widget">
        <span className="glass-app-icon mint">
          <History size={22} />
        </span>
        <div>
          <small>PICK UP WHERE YOU LEFT OFF</small>
          <strong>
            {recent
              ? `${recent} recent ${books ? "reads" : "watches"}`
              : "Your next little escape"}
          </strong>
          <span>
            {recent ? "Return to your story." : "A fresh start awaits."}
          </span>
        </div>
        <ArrowUpRight className="widget-arrow" size={18} />
      </Link>
      <Link to={books ? "/search" : "/watchable"} className="glass-widget">
        <span className="glass-app-icon violet">
          <Compass size={22} />
        </span>
        <div>
          <small>FOLLOW YOUR CURIOSITY</small>
          <strong>Find something extraordinary</strong>
          <span>Explore {reading.mode}.</span>
        </div>
        <ArrowUpRight className="widget-arrow" size={18} />
      </Link>
    </section>
  );
}
