import { toast } from 'sonner';

export interface StoredPaymentData {
  reference: string;
  orderId: string;
  amount: number;
  email: string;
  timestamp: number;
}

export class PaymentRecoveryUtil {
  private static readonly STORAGE_KEYS = {
    reference: 'paystack_payment_reference',
    lastReference: 'paystack_last_reference',
    orderId: 'payment_order_id',
    paymentData: 'payment_recovery_data'
  };

  private static readonly RECOVERY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Store payment data for recovery with defense-in-depth approach
   */
  static storePaymentData(data: Omit<StoredPaymentData, 'timestamp'>): boolean {
    try {
      const paymentData: StoredPaymentData = {
        ...data,
        timestamp: Date.now()
      };

      // Store in multiple locations for reliability
      sessionStorage.setItem(this.STORAGE_KEYS.reference, data.reference);
      sessionStorage.setItem(this.STORAGE_KEYS.orderId, data.orderId);
      sessionStorage.setItem(this.STORAGE_KEYS.paymentData, JSON.stringify(paymentData));
      
      localStorage.setItem(this.STORAGE_KEYS.lastReference, data.reference);
      localStorage.setItem(this.STORAGE_KEYS.paymentData, JSON.stringify(paymentData));

      console.log('💾 Payment data stored for recovery:', {
        reference: data.reference,
        orderId: data.orderId
      });

      return true;
    } catch (error) {
      console.warn('⚠️ Failed to store payment data:', error);
      return false;
    }
  }

  /**
   * Retrieve stored payment data for recovery
   */
  static getStoredPaymentData(): StoredPaymentData | null {
    try {
      // Try session storage first (more recent)
      let dataStr = sessionStorage.getItem(this.STORAGE_KEYS.paymentData);
      
      // Fallback to localStorage
      if (!dataStr) {
        dataStr = localStorage.getItem(this.STORAGE_KEYS.paymentData);
      }

      if (!dataStr) {
        // Try individual keys as fallback
        const reference = sessionStorage.getItem(this.STORAGE_KEYS.reference) || 
                         localStorage.getItem(this.STORAGE_KEYS.lastReference);
        const orderId = sessionStorage.getItem(this.STORAGE_KEYS.orderId);

        if (reference && orderId) {
          return {
            reference,
            orderId,
            amount: 0,
            email: '',
            timestamp: Date.now()
          };
        }

        return null;
      }

      const data: StoredPaymentData = JSON.parse(dataStr);

      // Check if data is not too old
      if (Date.now() - data.timestamp > this.RECOVERY_TIMEOUT) {
        console.log('🕐 Stored payment data is too old, ignoring');
        this.clearStoredData();
        return null;
      }

      return data;
    } catch (error) {
      console.warn('⚠️ Failed to retrieve payment data:', error);
      return null;
    }
  }

  /**
   * Clear all stored payment data
   */
  static clearStoredData(): void {
    try {
      Object.values(this.STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
      });

      console.log('🧹 Payment recovery data cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear payment data:', error);
    }
  }

  /**
   * Check if there's a payment in progress
   */
  static hasPaymentInProgress(): boolean {
    const data = this.getStoredPaymentData();
    return data !== null;
  }

  /**
   * Show user-friendly error messages
   */
  static showUserFriendlyError(error: string): void {
    if (error.includes('CONFIG_ERROR') || error.includes('Secret key not configured')) {
      toast.error('Payment service is temporarily unavailable. Please try again later.');
    } else if (error.includes('ORDER_NOT_FOUND')) {
      toast.error('Payment reference not found. Please contact support.');
    } else if (error.includes('NETWORK_ERROR') || error.includes('timeout')) {
      toast.error('Network error. Please check your connection and try again.');
    } else if (error.includes('VALIDATION_ERROR')) {
      toast.error('Invalid payment details. Please verify and try again.');
    } else {
      toast.error(`Payment error: ${error}`);
    }
  }
}