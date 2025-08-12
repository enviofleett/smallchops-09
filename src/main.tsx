import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./utils/webVitals";

// Initialize performance monitoring
initWebVitals();

// 🚨 CRITICAL: Clear payment-related cache and validate backend references
function clearPaymentCache() {
  const paymentKeys = Object.keys(localStorage).filter(key => 
    key.includes('payment') || key.includes('pay_') || key.includes('reference')
  );
  
  paymentKeys.forEach(key => {
    console.warn('🚨 Clearing cached payment data:', key);
    localStorage.removeItem(key);
  });
  
  const sessionKeys = Object.keys(sessionStorage).filter(key => 
    key.includes('payment') || key.includes('pay_') || key.includes('reference')
  );
  
  sessionKeys.forEach(key => {
    console.warn('🚨 Clearing cached session payment data:', key);
    sessionStorage.removeItem(key);
  });
  
  // Add deployment version check
  const currentVersion = '1.0.2'; // Increment on each critical fix
  const cachedVersion = localStorage.getItem('app_version');
  
  if (cachedVersion !== currentVersion) {
    console.warn('🚨 App version changed, clearing all caches:', cachedVersion, '→', currentVersion);
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('app_version', currentVersion);
  }
}

// Execute cache cleanup
clearPaymentCache();

// 🚨 CRITICAL: Runtime payment reference validation (non-blocking)
(window as any).validatePaymentReference = (reference: string) => {
  if (reference && reference.startsWith('pay_')) {
    console.error('🚨 FRONTEND REFERENCE DETECTED:', reference);
    console.trace('Frontend reference creation trace:');
    // Log but don't throw in production to maintain stability
    return false;
  }
  
  if (reference && !reference.startsWith('txn_')) {
    console.warn('🚨 INVALID REFERENCE FORMAT:', reference);
    return false;
  }
  
  return true;
};

// Monitor fetch requests for payment references (non-blocking)
const originalFetch = window.fetch;
window.fetch = async (url, options) => {
  if (options?.body) {
    try {
      const body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      // Only check for frontend-generated pay_ references, not all pay_ strings
      if (body.match(/pay_\d+_[a-zA-Z0-9]+/)) {
        console.error('🚨 FRONTEND REFERENCE IN REQUEST:', { url, body });
        console.trace('Request stack trace:');
      }
    } catch (error) {
      // Don't break requests if body inspection fails
      console.warn('Could not inspect request body:', error);
    }
  }
  return originalFetch(url, options);
};

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
