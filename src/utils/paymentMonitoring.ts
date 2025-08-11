/**
 * Payment flow monitoring utilities for production debugging
 */

interface PaymentFlowEvent {
  timestamp: number;
  event: string;
  reference?: string;
  source: string;
  data?: any;
}

class PaymentMonitor {
  private events: PaymentFlowEvent[] = [];
  private maxEvents = 50;

  logEvent(event: string, reference?: string, source: string = 'unknown', data?: any) {
    const flowEvent: PaymentFlowEvent = {
      timestamp: Date.now(),
      event,
      reference,
      source,
      data
    };

    this.events.push(flowEvent);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Console log for debugging
    console.log(`🔍 [${source}] ${event}`, {
      reference,
      timestamp: new Date().toISOString(),
      ...data
    });

    // Store critical events in sessionStorage for cross-page debugging
    if (this.isCriticalEvent(event)) {
      this.storeCriticalEvent(flowEvent);
    }
  }

  private isCriticalEvent(event: string): boolean {
    const criticalEvents = [
      'payment_initialized',
      'reference_generated',
      'callback_received',
      'verification_started',
      'verification_completed',
      'payment_failed',
      'reference_missing'
    ];
    return criticalEvents.includes(event);
  }

  private storeCriticalEvent(event: PaymentFlowEvent) {
    try {
      const stored = JSON.parse(sessionStorage.getItem('payment_critical_events') || '[]');
      stored.push(event);
      
      // Keep only last 10 critical events
      if (stored.length > 10) {
        stored.splice(0, stored.length - 10);
      }
      
      sessionStorage.setItem('payment_critical_events', JSON.stringify(stored));
    } catch (error) {
      console.warn('Failed to store critical payment event:', error);
    }
  }

  getRecentEvents(count = 10): PaymentFlowEvent[] {
    return this.events.slice(-count);
  }

  getCriticalEvents(): PaymentFlowEvent[] {
    try {
      return JSON.parse(sessionStorage.getItem('payment_critical_events') || '[]');
    } catch {
      return [];
    }
  }

  generateDebugReport(): string {
    const critical = this.getCriticalEvents();
    const recent = this.getRecentEvents();
    
    return `
=== PAYMENT FLOW DEBUG REPORT ===
Generated: ${new Date().toISOString()}

CRITICAL EVENTS (${critical.length}):
${critical.map(e => `${new Date(e.timestamp).toISOString()} [${e.source}] ${e.event} ${e.reference || ''}`).join('\n')}

RECENT EVENTS (${recent.length}):
${recent.map(e => `${new Date(e.timestamp).toISOString()} [${e.source}] ${e.event} ${e.reference || ''}`).join('\n')}

REFERENCE TRACKING:
- Current URL: ${window.location.href}
- Session Storage Keys: ${Object.keys(sessionStorage).filter(k => k.includes('payment') || k.includes('paystack')).join(', ')}
- Local Storage Keys: ${Object.keys(localStorage).filter(k => k.includes('payment') || k.includes('paystack')).join(', ')}
`.trim();
  }

  clearEvents() {
    this.events = [];
    try {
      sessionStorage.removeItem('payment_critical_events');
    } catch {}
  }
}

// Singleton instance
export const paymentMonitor = new PaymentMonitor();

// Helper functions for common monitoring scenarios
export const logPaymentInitialized = (reference: string, source: string, data?: any) => {
  paymentMonitor.logEvent('payment_initialized', reference, source, data);
};

export const logReferenceGenerated = (reference: string, format: string, source: string) => {
  paymentMonitor.logEvent('reference_generated', reference, source, { format });
};

export const logCallbackReceived = (reference?: string, allParams?: Record<string, string>) => {
  paymentMonitor.logEvent('callback_received', reference, 'payment_callback', { allParams });
};

export const logVerificationStarted = (reference: string) => {
  paymentMonitor.logEvent('verification_started', reference, 'payment_verification');
};

export const logVerificationCompleted = (reference: string, success: boolean, data?: any) => {
  paymentMonitor.logEvent('verification_completed', reference, 'payment_verification', { success, ...data });
};

export const logPaymentFailed = (reference?: string, error?: string, source: string = 'payment_flow') => {
  paymentMonitor.logEvent('payment_failed', reference, source, { error });
};

export const logReferenceMissing = (source: string, availableParams?: string[]) => {
  paymentMonitor.logEvent('reference_missing', undefined, source, { availableParams });
};

// Global error handler for payment-related issues
window.addEventListener('error', (event) => {
  if (event.message && (
    event.message.includes('paystack') || 
    event.message.includes('payment') ||
    event.message.includes('reference')
  )) {
    paymentMonitor.logEvent('payment_error', undefined, 'window_error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno
    });
  }
});
