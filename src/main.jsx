import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "./store";
import App from "./App";
import { UniverseProvider } from "./universe";
import "./styles.css";
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
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <UniverseProvider>
            <App />
          </UniverseProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
