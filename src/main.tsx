import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./utils/webVitals";
import { productionMonitoring } from "./utils/productionMonitoring";

// Initialize performance monitoring
initWebVitals();

// Initialize production monitoring
if (import.meta.env.PROD) {
  console.log('🔍 Production monitoring enabled');
}

// PRODUCTION-SAFE: Minimal cache management for stability
function safeCacheCleanup() {
  try {
    // Only clear potentially problematic payment data
    const paymentKeys = ['payment_reference', 'payment_session', 'payment_tx'];
    paymentKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    });

    // Version tracking for major updates only
    const currentVersion = '1.1.0';
    const lastVersion = localStorage.getItem('app_version');
    
    if (!lastVersion) {
      localStorage.setItem('app_version', currentVersion);
    }
    
    console.info('✅ Cache cleanup completed safely');
  } catch (error) {
    console.warn('Cache cleanup failed:', error);
  }
}

// Execute safe cleanup
safeCacheCleanup();

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
