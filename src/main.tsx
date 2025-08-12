import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./utils/webVitals";

// Initialize performance monitoring
initWebVitals();

// Production-safe payment cache management
function clearPaymentCache() {
  try {
    // Only clear payment-specific keys, not all storage
    const paymentKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('payment_') || key.startsWith('pay_') || key.includes('reference') || key.includes('transaction')
    );
    
    paymentKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    const sessionKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith('payment_') || key.startsWith('pay_') || key.includes('reference') || key.includes('transaction')
    );
    
    sessionKeys.forEach(key => {
      sessionStorage.removeItem(key);
    });
    
    // Gentle version check - only clear if major version change
    const currentVersion = '1.0.3';
    const cachedVersion = localStorage.getItem('app_version');
    
    // Only clear on major version changes (not patch versions)
    if (cachedVersion && !cachedVersion.startsWith('1.0')) {
      console.info('Major version change detected, clearing caches');
      localStorage.clear();
      sessionStorage.clear();
    }
    
    localStorage.setItem('app_version', currentVersion);
  } catch (error) {
    console.warn('Cache cleanup failed:', error);
  }
}

// Safe cache cleanup
clearPaymentCache();

// Production-safe monitoring (logging only, no blocking)
if (process.env.NODE_ENV === 'development') {
  (window as any).validatePaymentReference = (reference: string) => {
    if (reference && reference.startsWith('pay_')) {
      console.warn('Frontend reference detected:', reference);
      return false;
    }
    return true;
  };
}

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
