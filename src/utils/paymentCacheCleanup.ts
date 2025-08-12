import { toast } from "sonner";

/**
 * 🧹 Payment Cache Cleanup Utility
 * Removes legacy pay_ references and invalid cached data
 */

export const cleanupPaymentCache = (): void => {
  console.log('🧹 Starting payment cache cleanup...');
  
  // List of keys to check for pay_ references
  const storageKeys = [
    'pending_payment_reference',
    'paystack_reference',
    'checkout_reference',
    'payment_reference',
    'last_payment_ref',
    'order_payment_ref'
  ];
  
  let cleanedCount = 0;
  
  // Clean localStorage
  storageKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && value.includes('pay_')) {
      console.warn('🧹 Removing legacy reference from localStorage:', key, value);
      localStorage.removeItem(key);
      cleanedCount++;
    }
  });
  
  // Clean sessionStorage
  storageKeys.forEach(key => {
    const value = sessionStorage.getItem(key);
    if (value && value.includes('pay_')) {
      console.warn('🧹 Removing legacy reference from sessionStorage:', key, value);
      sessionStorage.removeItem(key);
      cleanedCount++;
    }
  });
  
  // Scan all localStorage keys for any pay_ patterns
  Object.keys(localStorage).forEach(key => {
    const value = localStorage.getItem(key);
    if (value && /pay_\d+_[a-z0-9]+/.test(value)) {
      console.warn('🧹 Removing detected legacy reference:', key, value);
      localStorage.removeItem(key);
      cleanedCount++;
    }
  });
  
  if (cleanedCount > 0) {
    console.log(`✅ Payment cache cleanup completed: ${cleanedCount} items removed`);
    toast.success(`Cleaned ${cleanedCount} legacy payment references`);
  } else {
    console.log('✅ Payment cache is clean');
  }
};

export const validateStoredReference = (reference: string | null): boolean => {
  if (!reference) return false;
  
  if (reference.startsWith('pay_')) {
    console.error('🚨 Legacy reference detected in storage:', reference);
    return false;
  }
  
  return reference.startsWith('txn_');
};

// Initialize cleanup on module load
if (typeof window !== 'undefined') {
  cleanupPaymentCache();
}