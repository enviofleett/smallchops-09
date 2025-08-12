// ========================================
// 🔧 PAYMENT REFERENCE MONITORING
// ========================================

/**
 * Validate payment reference format and log violations
 */
export const validatePaymentReference = (reference: string): boolean => {
  if (reference.startsWith('pay_')) {
    console.error('🚨 CRITICAL: Frontend reference detected!', reference);
    
    // Log security incident
    const incident = {
      type: 'FRONTEND_REFERENCE_DETECTED',
      reference,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Store locally for debugging
    const incidents = JSON.parse(localStorage.getItem('security_incidents') || '[]');
    incidents.push(incident);
    localStorage.setItem('security_incidents', JSON.stringify(incidents.slice(-10))); // Keep last 10
    
    // Send alert if fetch is available
    if (typeof fetch !== 'undefined') {
      fetch('/api/security-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident)
      }).catch(err => console.warn('Failed to send security alert:', err));
    }
    
    return false;
  }
  return reference.startsWith('txn_');
};

/**
 * Force cache refresh for payment system
 */
export const forceCacheRefresh = (): void => {
  const APP_VERSION = '2025.08.12.001';
  const storedVersion = localStorage.getItem('app_version');
  
  if (storedVersion !== APP_VERSION) {
    console.log('🔄 Forcing cache refresh for payment system');
    
    // Clear all payment-related cache
    localStorage.removeItem('pending_payment_reference');
    localStorage.removeItem('paystack_reference');
    sessionStorage.removeItem('checkout_reference');
    sessionStorage.removeItem('payment_in_progress');
    
    // Set new version
    localStorage.setItem('app_version', APP_VERSION);
    
    // Force reload if old version detected and this isn't already a refresh
    if (!sessionStorage.getItem('cache_refresh_done')) {
      sessionStorage.setItem('cache_refresh_done', 'true');
      window.location.reload();
    }
  }
};

/**
 * Legacy payment monitoring functions for backward compatibility
 */
export const logCallbackReceived = (reference?: string, params?: any): void => {
  console.log('📞 Payment callback received:', reference, params);
  if (reference) validatePaymentReference(reference);
};

export const logVerificationStarted = (reference: string): void => {
  console.log('🔍 Payment verification started:', reference);
  validatePaymentReference(reference);
};

export const logVerificationCompleted = (reference: string, success: boolean, metadata?: any): void => {
  console.log('✅ Payment verification completed:', reference, success, metadata);
  validatePaymentReference(reference);
};

export const logReferenceMissing = (context?: string, params?: any): void => {
  console.error('🚨 Payment reference missing from callback', context, params);
};

/**
 * Initialize payment monitoring
 */
export const initPaymentMonitoring = (): void => {
  // Force cache refresh on load
  forceCacheRefresh();
  
  // Clear service worker cache
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }
  
  console.log('✅ Payment monitoring initialized - backend references only');
};