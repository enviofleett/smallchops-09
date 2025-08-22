/**
 * Robust Storage Utility
 * Provides fallback mechanisms for storage operations when sessionStorage/localStorage
 * are not available (e.g., due to privacy settings, incognito mode, or SDK conflicts)
 */

interface StorageItem {
  value: any;
  timestamp: number;
}

// In-memory fallback storage
const memoryStorage = new Map<string, StorageItem>();

/**
 * Check if storage is available
 */
const isStorageAvailable = (storageType: 'localStorage' | 'sessionStorage'): boolean => {
  try {
    const storage = window[storageType];
    const testKey = '__storage_test__';
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Robust storage operations with fallbacks
 */
export class RobustStorage {
  
  /**
   * Set item with automatic fallback chain
   */
  static setItem(key: string, value: any, preferSession: boolean = true): boolean {
    const serializedValue = JSON.stringify(value);
    const item: StorageItem = {
      value: serializedValue,
      timestamp: Date.now()
    };

    // Try preferred storage first
    if (preferSession && isStorageAvailable('sessionStorage')) {
      try {
        sessionStorage.setItem(key, serializedValue);
        console.log(`✅ Stored in sessionStorage: ${key}`);
        return true;
      } catch (error) {
        console.warn(`⚠️ SessionStorage failed for ${key}:`, error);
      }
    }

    // Fallback to localStorage
    if (isStorageAvailable('localStorage')) {
      try {
        localStorage.setItem(key, serializedValue);
        console.log(`✅ Stored in localStorage: ${key}`);
        return true;
      } catch (error) {
        console.warn(`⚠️ LocalStorage failed for ${key}:`, error);
      }
    }

    // Final fallback to memory storage
    memoryStorage.set(key, item);
    console.log(`✅ Stored in memory: ${key}`);
    return true;
  }

  /**
   * Get item with automatic fallback chain
   */
  static getItem(key: string, preferSession: boolean = true): any | null {
    // Try preferred storage first
    if (preferSession && isStorageAvailable('sessionStorage')) {
      try {
        const value = sessionStorage.getItem(key);
        if (value !== null) {
          console.log(`✅ Retrieved from sessionStorage: ${key}`);
          return JSON.parse(value);
        }
      } catch (error) {
        console.warn(`⚠️ SessionStorage read failed for ${key}:`, error);
      }
    }

    // Fallback to localStorage
    if (isStorageAvailable('localStorage')) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) {
          console.log(`✅ Retrieved from localStorage: ${key}`);
          return JSON.parse(value);
        }
      } catch (error) {
        console.warn(`⚠️ LocalStorage read failed for ${key}:`, error);
      }
    }

    // Final fallback to memory storage
    const memoryItem = memoryStorage.get(key);
    if (memoryItem) {
      console.log(`✅ Retrieved from memory: ${key}`);
      return JSON.parse(memoryItem.value);
    }

    return null;
  }

  /**
   * Remove item from all storage locations
   */
  static removeItem(key: string): void {
    // Remove from sessionStorage
    if (isStorageAvailable('sessionStorage')) {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        console.warn(`⚠️ SessionStorage removal failed for ${key}:`, error);
      }
    }

    // Remove from localStorage
    if (isStorageAvailable('localStorage')) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`⚠️ LocalStorage removal failed for ${key}:`, error);
      }
    }

    // Remove from memory storage
    memoryStorage.delete(key);
    console.log(`✅ Removed ${key} from all storage locations`);
  }

  /**
   * Get storage status for debugging
   */
  static getStorageStatus(): {
    sessionStorage: boolean;
    localStorage: boolean;
    memoryItems: number;
  } {
    return {
      sessionStorage: isStorageAvailable('sessionStorage'),
      localStorage: isStorageAvailable('localStorage'),
      memoryItems: memoryStorage.size
    };
  }

  /**
   * Clear memory storage (for cleanup)
   */
  static clearMemoryStorage(): void {
    memoryStorage.clear();
    console.log('🧹 Memory storage cleared');
  }

  /**
   * Log storage diagnostics for debugging
   */
  static logStorageDiagnostics(): void {
    const status = RobustStorage.getStorageStatus();
    console.log('💾 Storage Diagnostics:', {
      sessionStorageAvailable: status.sessionStorage,
      localStorageAvailable: status.localStorage,
      memoryItems: status.memoryItems,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Enhanced payment storage utilities using robust storage
 */
export class PaymentStorage {
  
  static storePaymentSuccess(orderDetails: any): void {
    try {
      RobustStorage.setItem('paymentSuccess', orderDetails, true);
      RobustStorage.setItem('lastPaymentSuccess', orderDetails, false);
      console.log('✅ Payment success details stored');
    } catch (error) {
      console.error('❌ Failed to store payment success details:', error);
      // Log error for analytics/debugging
      console.error('💾 Payment Storage Error Details:', {
        error: error instanceof Error ? error.message : String(error),
        orderDetails: orderDetails,
        storageStatus: RobustStorage.getStorageStatus(),
        timestamp: Date.now()
      });
    }
  }

  static getPaymentSuccess(): any | null {
    try {
      return RobustStorage.getItem('paymentSuccess', true) || 
             RobustStorage.getItem('lastPaymentSuccess', false);
    } catch (error) {
      console.warn('⚠️ Failed to retrieve payment success details:', error);
      return null;
    }
  }

  static clearPaymentStorage(): void {
    RobustStorage.removeItem('paymentSuccess');
    RobustStorage.removeItem('lastPaymentSuccess');
    RobustStorage.removeItem('paystack_payment_reference');
    RobustStorage.removeItem('payment_order_id');
    RobustStorage.removeItem('paystack_last_reference');
    RobustStorage.removeItem('paymentReference');
    console.log('🧹 Payment storage cleared');
  }
}