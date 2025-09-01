/**
 * Secure Storage Utility
 * Minimizes sensitive data stored in browser storage
 */

interface SecureStorageConfig {
  maxAge?: number; // Maximum age in milliseconds
  encrypt?: boolean; // Whether to encrypt data (basic obfuscation)
}

class SecureStorage {
  private readonly PREFIX = 'app_';
  
  /**
   * Store data securely with automatic expiration
   */
  set(key: string, value: any, config: SecureStorageConfig = {}): void {
    const { maxAge = 3600000, encrypt = false } = config; // Default 1 hour
    
    const data = {
      value: encrypt ? this.obfuscate(JSON.stringify(value)) : value,
      timestamp: Date.now(),
      maxAge,
      encrypted: encrypt
    };
    
    try {
      sessionStorage.setItem(this.PREFIX + key, JSON.stringify(data));
    } catch (error) {
      console.warn('SecureStorage: Failed to store data', error);
    }
  }
  
  /**
   * Retrieve data with automatic expiration check
   */
  get(key: string): any {
    try {
      const stored = sessionStorage.getItem(this.PREFIX + key);
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      
      // Check if data has expired
      if (Date.now() - data.timestamp > data.maxAge) {
        this.remove(key);
        return null;
      }
      
      // Decrypt if needed
      if (data.encrypted) {
        return JSON.parse(this.deobfuscate(data.value));
      }
      
      return data.value;
    } catch (error) {
      console.warn('SecureStorage: Failed to retrieve data', error);
      this.remove(key);
      return null;
    }
  }
  
  /**
   * Remove data from storage
   */
  remove(key: string): void {
    sessionStorage.removeItem(this.PREFIX + key);
  }
  
  /**
   * Clear all app data from storage
   */
  clear(): void {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(this.PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  }
  
  /**
   * Clean expired data
   */
  cleanup(): void {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(this.PREFIX)) {
        const keyName = key.substring(this.PREFIX.length);
        this.get(keyName); // This will auto-remove expired items
      }
    });
  }
  
  /**
   * Basic obfuscation (NOT cryptographically secure)
   */
  private obfuscate(str: string): string {
    return btoa(str.split('').reverse().join(''));
  }
  
  /**
   * Basic deobfuscation
   */
  private deobfuscate(str: string): string {
    return atob(str).split('').reverse().join('');
  }
}

export const secureStorage = new SecureStorage();

/**
 * Store checkout data temporarily with auto-expiration
 */
export const storeCheckoutData = (data: any) => {
  secureStorage.set('checkout', data, { maxAge: 1800000 }); // 30 minutes
};

/**
 * Retrieve checkout data
 */
export const getCheckoutData = () => {
  return secureStorage.get('checkout');
};

/**
 * Clear checkout data
 */
export const clearCheckoutData = () => {
  secureStorage.remove('checkout');
};

/**
 * Initialize secure storage cleanup
 */
export const initializeSecureStorage = () => {
  // Clean up expired data on load
  secureStorage.cleanup();
  
  // Set up periodic cleanup (every 10 minutes)
  setInterval(() => {
    secureStorage.cleanup();
  }, 600000);
  
  console.log('✅ Secure storage initialized');
};