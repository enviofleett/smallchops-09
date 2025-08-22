/**
 * Production Console Cleanup Utility
 * Suppresses development-specific console errors and warnings in production
 */

export const initializeConsoleCleanup = () => {
  if (process.env.NODE_ENV === 'production') {
    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Error patterns to suppress in production
    const suppressErrorPatterns = [
      'WebSocket connection',
      'inject.bundle.js', 
      'localhost:8080',
      'Content Security Policy',
      'Refused to load',
      'script-src-elem',
      'style-src-elem',
      'Refused to execute inline script',
      'Refused to apply inline style',
      'ws://localhost',
      'wss://localhost',
      'Failed to construct \'WebSocket\'',
      'Datadog Browser SDK: No vendor',  // Datadog SDK storage errors
      'No storage available for session', // Datadog specific storage issue
      'sessionStorage is not available',   // Generic session storage issues
      'localStorage is not available',     // Generic local storage issues
    ];
    
    // Warning patterns to suppress in production  
    const suppressWarnPatterns = [
      'Download the React DevTools',
      'React DevTools',
      'development mode',
      'DevTools extension',
      'WebSocket connection to',
    ];
    
    // Override console.error
    console.error = (...args) => {
      const message = args.join(' ');
      
      // Check if this error should be suppressed
      if (suppressErrorPatterns.some(pattern => message.includes(pattern))) {
        return; // Suppress these errors in production
      }
      
      // Allow legitimate errors through
      originalError.apply(console, args);
    };
    
    // Override console.warn
    console.warn = (...args) => {
      const message = args.join(' ');
      
      // Check if this warning should be suppressed
      if (suppressWarnPatterns.some(pattern => message.includes(pattern))) {
        return; // Suppress these warnings in production
      }
      
      // Allow legitimate warnings through
      originalWarn.apply(console, args);
    };
    
    // Success message
    console.log('✅ Production console cleanup initialized');
  } else {
    // Development mode - show everything
    console.log('🔧 Development mode: All console messages visible');
  }
};

/**
 * Ensures Paystack CSP compatibility by checking and warning about potential issues
 */
export const validatePaystackCSP = () => {
  try {
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (cspMeta) {
      const content = cspMeta.getAttribute('content') || '';
      
      const requiredDomains = [
        'checkout.paystack.com',
        'js.paystack.co', 
        'api.paystack.co',
        'paystack.com'  // Added for button.min.css and other assets
      ];
      
      const missingDomains = requiredDomains.filter(domain => !content.includes(domain));
      
      if (missingDomains.length > 0) {
        console.warn('⚠️ CSP may block Paystack domains:', missingDomains);
        return false;
      }
      
      console.log('✅ Paystack CSP validation passed');
      return true;
    }
    
    console.warn('⚠️ No CSP meta tag found');
    return false;
  } catch (error) {
    console.error('CSP validation error:', error);
    return false;
  }
};

/**
 * Enhanced error suppression for WebSocket connections in production
 */
export const suppressWebSocketErrors = () => {
  if (process.env.NODE_ENV === 'production') {
    // Suppress WebSocket constructor errors
    const originalWebSocket = window.WebSocket;
    
    window.WebSocket = class extends originalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        try {
          super(url, protocols);
        } catch (error) {
          // Suppress WebSocket connection errors for development tools
          const urlString = url.toString();
          if (urlString.includes('localhost') || urlString.includes('127.0.0.1')) {
            // Silently fail for localhost connections
            throw new Error('Development WebSocket suppressed in production');
          }
          throw error;
        }
      }
    };
  }
};