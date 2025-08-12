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
  const currentVersion = '1.0.1'; // Increment on each critical fix
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

// 🚨 CRITICAL: Runtime payment reference validation
(window as any).validatePaymentReference = (reference: string) => {
  if (reference && reference.startsWith('pay_')) {
    console.error('🚨 FRONTEND REFERENCE DETECTED:', reference);
    console.trace('Frontend reference creation trace:');
    throw new Error('SECURITY VIOLATION: Frontend payment reference detected');
  }
  
  if (reference && !reference.startsWith('txn_')) {
    console.error('🚨 INVALID REFERENCE FORMAT:', reference);
    console.trace('Invalid reference trace:');
    return false;
  }
  
  return true;
};

// Intercept fetch requests to validate payment references
const originalFetch = window.fetch;
window.fetch = async (url, options) => {
  if (options?.body) {
    const body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    if (body.includes('pay_')) {
      console.error('🚨 FRONTEND REFERENCE IN REQUEST:', { url, body });
      console.trace('Request stack trace:');
      throw new Error('SECURITY VIOLATION: Frontend payment reference in request');
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
