import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./utils/webVitals";

// Initialize performance monitoring
initWebVitals();

// Disable existing service workers to prevent stale asset caching that can break dynamic imports
if ('serviceWorker' in navigator) {
  // Unregister any existing service workers immediately
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {});
  
  // Best-effort: clear caches created by previous SW versions
  // This avoids "Failed to fetch dynamically imported module" due to old chunks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).caches?.keys?.().then((keys: string[]) => {
    keys.forEach((k) => (window as any).caches?.delete?.(k));
  }).catch(() => {});
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
);
