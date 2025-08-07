interface CheckoutState {
  formData: any;
  checkoutStep: string;
  deliveryFee: number;
  timestamp: number;
  version: string;
}

const CHECKOUT_STATE_KEY = 'checkout_recovery_state';
const STATE_VERSION = '1.0';
const STATE_EXPIRY_MINUTES = 30;

/**
 * Payment State Recovery System
 * Saves and recovers checkout state for failed payment attempts
 */
export class CheckoutStateManager {
  /**
   * Save current checkout state to localStorage
   */
  static saveCheckoutState(
    formData: any,
    checkoutStep: string,
    deliveryFee: number
  ): void {
    try {
      const state: CheckoutState = {
        formData,
        checkoutStep,
        deliveryFee,
        timestamp: Date.now(),
        version: STATE_VERSION
      };

      localStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(state));
      console.log('💾 Checkout state saved successfully:', {
        step: checkoutStep,
        timestamp: new Date(state.timestamp).toISOString(),
        hasFormData: !!formData
      });
    } catch (error) {
      console.error('❌ Failed to save checkout state:', error);
    }
  }

  /**
   * Recover checkout state from localStorage
   */
  static recoverCheckoutState(): CheckoutState | null {
    try {
      const savedState = localStorage.getItem(CHECKOUT_STATE_KEY);
      if (!savedState) {
        console.log('📝 No saved checkout state found');
        return null;
      }

      const state: CheckoutState = JSON.parse(savedState);
      
      // Check if state has expired
      const ageMinutes = (Date.now() - state.timestamp) / (1000 * 60);
      if (ageMinutes > STATE_EXPIRY_MINUTES) {
        console.log('⏰ Saved checkout state has expired, clearing...');
        this.clearCheckoutState();
        return null;
      }

      // Check version compatibility
      if (state.version !== STATE_VERSION) {
        console.log('🔄 Checkout state version mismatch, clearing...');
        this.clearCheckoutState();
        return null;
      }

      console.log('✅ Checkout state recovered successfully:', {
        step: state.checkoutStep,
        age: `${Math.round(ageMinutes)} minutes`,
        hasFormData: !!state.formData
      });

      return state;
    } catch (error) {
      console.error('❌ Failed to recover checkout state:', error);
      this.clearCheckoutState();
      return null;
    }
  }

  /**
   * Clear saved checkout state
   */
  static clearCheckoutState(): void {
    try {
      localStorage.removeItem(CHECKOUT_STATE_KEY);
      console.log('🗑️ Checkout state cleared');
    } catch (error) {
      console.error('❌ Failed to clear checkout state:', error);
    }
  }

  /**
   * Check if there's a recoverable state available
   */
  static hasRecoverableState(): boolean {
    return this.recoverCheckoutState() !== null;
  }

  /**
   * Save just before payment attempt
   */
  static savePrePaymentState(
    formData: any,
    checkoutStep: string,
    deliveryFee: number,
    paymentAttemptId: string
  ): void {
    try {
      const extendedState = {
        formData,
        checkoutStep,
        deliveryFee,
        timestamp: Date.now(),
        version: STATE_VERSION,
        paymentAttemptId,
        stage: 'pre_payment'
      };

      localStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(extendedState));
      console.log('💳 Pre-payment state saved:', {
        attemptId: paymentAttemptId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to save pre-payment state:', error);
    }
  }

  /**
   * Mark payment as completed successfully
   */
  static markPaymentCompleted(): void {
    this.clearCheckoutState();
    console.log('✅ Payment completed, checkout state cleared');
  }

  /**
   * Handle payment failure and prepare for retry
   */
  static handlePaymentFailure(errorDetails?: any): void {
    try {
      const savedState = localStorage.getItem(CHECKOUT_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        const failureState = {
          ...state,
          lastFailure: {
            timestamp: Date.now(),
            error: errorDetails,
            retryCount: (state.retryCount || 0) + 1
          },
          retryCount: (state.retryCount || 0) + 1
        };

        localStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(failureState));
        console.log('🔄 Payment failure recorded, state updated for retry:', {
          retryCount: failureState.retryCount,
          error: errorDetails
        });
      }
    } catch (error) {
      console.error('❌ Failed to handle payment failure state:', error);
    }
  }

  /**
   * Get retry information
   */
  static getRetryInfo(): { canRetry: boolean; retryCount: number; lastError?: any } {
    try {
      const savedState = localStorage.getItem(CHECKOUT_STATE_KEY);
      if (!savedState) {
        return { canRetry: false, retryCount: 0 };
      }

      const state = JSON.parse(savedState);
      const retryCount = state.retryCount || 0;
      const maxRetries = 3;

      return {
        canRetry: retryCount < maxRetries,
        retryCount,
        lastError: state.lastFailure?.error
      };
    } catch (error) {
      console.error('❌ Failed to get retry info:', error);
      return { canRetry: false, retryCount: 0 };
    }
  }

  /**
   * Cleanup expired states (can be called periodically)
   */
  static cleanupExpiredStates(): void {
    const state = this.recoverCheckoutState();
    if (!state) {
      // This will clear expired states as a side effect
      console.log('🧹 Cleanup: No valid states found');
    }
  }
}

/**
 * Hook for React components to use checkout state management
 */
export function useCheckoutStateRecovery() {
  const saveState = (formData: any, checkoutStep: string, deliveryFee: number) => {
    CheckoutStateManager.saveCheckoutState(formData, checkoutStep, deliveryFee);
  };

  const recoverState = () => {
    return CheckoutStateManager.recoverCheckoutState();
  };

  const clearState = () => {
    CheckoutStateManager.clearCheckoutState();
  };

  const hasRecoverableState = () => {
    return CheckoutStateManager.hasRecoverableState();
  };

  const savePrePaymentState = (
    formData: any,
    checkoutStep: string,
    deliveryFee: number,
    paymentAttemptId: string
  ) => {
    CheckoutStateManager.savePrePaymentState(formData, checkoutStep, deliveryFee, paymentAttemptId);
  };

  const markPaymentCompleted = () => {
    CheckoutStateManager.markPaymentCompleted();
  };

  const handlePaymentFailure = (errorDetails?: any) => {
    CheckoutStateManager.handlePaymentFailure(errorDetails);
  };

  const getRetryInfo = () => {
    return CheckoutStateManager.getRetryInfo();
  };

  return {
    saveState,
    recoverState,
    clearState,
    hasRecoverableState,
    savePrePaymentState,
    markPaymentCompleted,
    handlePaymentFailure,
    getRetryInfo
  };
}