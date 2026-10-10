import React, { useEffect, useState } from "react";
import Brand from "./Brand";
import { useUniverse } from "./contentMode";
import "./splash.css";

function shouldShow() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}
export default function StartupSplash({ children }) {
  const [visible, setVisible] = useState(shouldShow);
  const [duration] = useState(() => window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches ? 3500 : 2100);
  const { mode } = useUniverse();
  const dismiss = () => {
    setVisible(false);
  };
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(dismiss, duration);
    const escape = e => { if (e.key === "Escape") dismiss(); };
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => { if (preference.matches) dismiss(); };
    document.addEventListener("keydown", escape);
    preference.addEventListener("change", reduce);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
      preference.removeEventListener("change", reduce);
    };
  }, [visible, duration]);
  return <>
    <div inert={visible ? true : undefined}>{children}</div>
    {visible && <div className="startup-splash" style={{ animationDelay: `${duration - 400}ms` }} role="dialog" aria-modal="true" aria-label="Welcome to SoraiX">
      <div className="splash-aurora" aria-hidden="true" />
      <div className="splash-orbit" aria-hidden="true" />
      <div className="splash-identity" aria-hidden="true" inert>
        <Brand mode={mode} />
        <p>Every story. A new universe.</p>
        <div className="splash-streak" />
      </div>
      <span className="splash-caption">WATCH · READ · DISCOVER</span>
      <button className="splash-skip" onClick={dismiss}>Skip intro</button>
    </div>}
  </>;
}
