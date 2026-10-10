import React, { useEffect, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { LandingContent } from "./landingContent";
import { BrowserRouter } from "react-router-dom";
import { AppProvider, readStore } from "./store";
import App from "./App";
import StartupSplash from "./StartupSplash";
import { UniverseProvider } from "./contentMode";
import "./styles.css";
import './themes.css';
import './glass-refinements.css';
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="empty">
        <h1>Let's try that again.</h1>
        <p>Something interrupted your journey.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload SoraiX
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Overview() {
  const [pathname, setPathname] = useState(location.pathname);
  const [mode, setMode] = useState("anime");
  useEffect(() => {
    const update = () => {
      setPathname(location.pathname);
      const saved = readStore("content-mode", "anime");
      setMode(["anime", "manga", "manhwa", "manhua", "donghua"].includes(saved) ? saved : "anime");
    };
    update();
    window.addEventListener("soraix:navigation", update);
    return () => window.removeEventListener("soraix:navigation", update);
  }, []);
  return <LandingContent pathname={pathname} mode={mode} />;
}
const overview = document.getElementById("site-overview");
if (overview.hasChildNodes()) hydrateRoot(overview, <Overview />);
else createRoot(overview).render(<Overview />);
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <UniverseProvider>
            <StartupSplash><App /></StartupSplash>
          </UniverseProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
