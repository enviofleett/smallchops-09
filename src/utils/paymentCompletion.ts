import { toast } from "sonner";

interface PaymentCompletionData {
  reference: string;
  orderNumber?: string;
  orderId?: string;
  amount?: number;
}

class PaymentCompletionCoordinator {
  private completionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private completedReferences: Set<string> = new Set();
  private globalLock = false;

  /**
   * Coordinates the 15-second payment completion flow
   * - Immediate success message
   * - 15-second delay for all completion actions
   * - Prevents race conditions and duplicate processing
   */
  coordinatePaymentCompletion(
    data: PaymentCompletionData,
    callbacks: {
      onClearCart: () => void;
      onStopMonitoring?: () => void;
      onNavigate?: () => void;
    }
  ): void {
    const { reference, orderNumber } = data;
    
    // Prevent duplicate processing
    if (this.completedReferences.has(reference) || this.globalLock) {
      console.log('🔒 Payment completion already initiated for reference:', reference);
      return;
    }

    // Lock this reference and set global lock
    this.completedReferences.add(reference);
    this.globalLock = true;

    console.log('🚀 Starting 15-second coordinated payment completion for:', reference);

    // Cancel any existing timeout for this reference
    const existingTimeout = this.completionTimeouts.get(reference);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.completionTimeouts.delete(reference);
    }

    // Stop any monitoring immediately
    if (callbacks.onStopMonitoring) {
      callbacks.onStopMonitoring();
    }

    // Emit global stop monitoring event
    window.dispatchEvent(new CustomEvent('payment-verification-complete', {
      detail: { reference, success: true }
    }));

    // Show immediate success message
    toast.success("Payment Verified!", {
      description: orderNumber 
        ? `Order ${orderNumber} confirmed. Finalizing your order...`
        : "Payment successful. Finalizing your order...",
      duration: 4000
    });

    // Set 15-second coordinated completion
    const completionTimeout = setTimeout(() => {
      console.log('⏰ 15-second completion timer triggered for:', reference);
      
      try {
        // Execute all completion actions simultaneously
        callbacks.onClearCart();
        
        // Show final success message
        toast.success("Order Complete!", {
          description: orderNumber 
            ? `Order ${orderNumber} is being processed. You can track it in your order history.`
            : "Your order is being processed. Check your order history for updates.",
          duration: 5000
        });

        // Clean up storage
        this.cleanupPaymentStorage(reference);

        // Navigate after a brief delay
        if (callbacks.onNavigate) {
          setTimeout(() => {
            callbacks.onNavigate?.();
          }, 1000);
        }

        console.log('✅ 15-second coordinated completion finished for:', reference);
        
      } catch (error) {
        console.error('❌ Error during coordinated completion:', error);
      } finally {
        // Clean up timeout and release locks
        this.completionTimeouts.delete(reference);
        this.globalLock = false;
      }
    }, 15000);

    // Store timeout for potential cleanup
    this.completionTimeouts.set(reference, completionTimeout);
  }

  /**
   * Force immediate completion (for manual triggers)
   */
  forceCompletion(reference: string, callbacks: {
    onClearCart: () => void;
    onNavigate?: () => void;
  }): void {
    console.log('🔧 Forcing immediate completion for:', reference);
    
    const timeout = this.completionTimeouts.get(reference);
    if (timeout) {
      clearTimeout(timeout);
      this.completionTimeouts.delete(reference);
    }

    callbacks.onClearCart();
    this.cleanupPaymentStorage(reference);
    
    if (callbacks.onNavigate) {
      callbacks.onNavigate();
    }

    this.globalLock = false;
  }

  /**
   * Check if a reference is already being processed
   */
  isProcessing(reference: string): boolean {
    return this.completedReferences.has(reference) || this.globalLock;
  }

  /**
   * Cancel completion for a reference
   */
  cancelCompletion(reference: string): void {
    const timeout = this.completionTimeouts.get(reference);
    if (timeout) {
      clearTimeout(timeout);
      this.completionTimeouts.delete(reference);
      console.log('🛑 Cancelled completion for:', reference);
    }
    this.completedReferences.delete(reference);
    this.globalLock = false;
  }

  /**
   * Clean up payment-related storage
   */
  private cleanupPaymentStorage(reference: string): void {
    try {
      // Clear all payment-related storage
      const keysToRemove = [
        'checkout_in_progress',
        'pending_payment_reference',
        'payment_in_progress',
        'paystack_last_reference',
        'last_payment_reference',
        'paymentReference',
        'paystack_reference'
      ];

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      console.log('🧹 Cleaned up payment storage for:', reference);
    } catch (error) {
      console.error('Error cleaning up payment storage:', error);
    }
  }

  /**
   * Reset the coordinator (for testing or emergency cleanup)
   */
  reset(): void {
    // Clear all timeouts
    this.completionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.completionTimeouts.clear();
    this.completedReferences.clear();
    this.globalLock = false;
    console.log('🔄 Payment completion coordinator reset');
  }
}

// Export singleton instance
export const paymentCompletionCoordinator = new PaymentCompletionCoordinator();

// Global event listener for monitoring components
window.addEventListener('payment-verification-complete', (event: any) => {
  const { reference, success } = event.detail;
  console.log('🌐 Global payment verification complete event:', { reference, success });
});