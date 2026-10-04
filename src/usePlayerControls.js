import { useEffect, useState } from "react";

export default function usePlayerControls(ref, episodeKey) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    let timer,
      fullscreen = false;
    const show = () => {
      clearTimeout(timer);
      target.classList.remove("player-controls-hidden");
      target.querySelectorAll("video").forEach((v) => {
        v.controls = true;
      });
      setHidden(false);
      if (fullscreen)
        timer = setTimeout(() => {
          // Keep keyboard interaction and open caption settings usable.
          if (target.querySelector(":focus-visible, .subtitle-panel")) return;
          target.classList.add("player-controls-hidden");
          target.querySelectorAll("video").forEach((v) => {
            v.controls = false;
          });
          setHidden(true);
        }, 3000);
    };
    const sync = () => {
      const active =
        document.fullscreenElement === target ||
        document.webkitFullscreenElement === target ||
        target.classList.contains("player-expanded");
      if (active !== fullscreen) {
        fullscreen = active;
        show();
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    const events = ["pointermove", "pointerdown", "keydown", "focusin"];
    events.forEach((name) => target.addEventListener(name, show, true));
    sync();
    show();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      events.forEach((name) => target.removeEventListener(name, show, true));
      target.classList.remove("player-controls-hidden");
      target.querySelectorAll("video").forEach((v) => {
        v.controls = true;
      });
    };
  }, [ref, episodeKey]);
  return hidden;
}
