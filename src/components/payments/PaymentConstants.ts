// PAYSTACK-ONLY PAYMENT CONSTANTS
// ================================
// Single source of truth for Paystack-only payment system

export const PAYMENT_GATEWAY = 'paystack' as const;

export const PAYSTACK_CONFIG = {
  BASE_URL: 'https://api.paystack.co',
  POPUP_URL: 'https://js.paystack.co/v1/inline.js',
  SUPPORTED_CURRENCIES: ['NGN'] as const,
  DEFAULT_CURRENCY: 'NGN' as const,
  TIMEOUT: 15000,
} as const;

export const PAYMENT_STATUS = {
  INITIALIZED: 'initialized',
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  ABANDONED: 'abandoned',
} as const;

export const PAYMENT_CHANNELS = [
  { id: 'card', name: 'Debit/Credit Card', description: 'Visa, Mastercard, Verve' },
  { id: 'bank_transfer', name: 'Bank Transfer', description: 'Direct bank transfer' },
  { id: 'ussd', name: 'USSD', description: 'Dial USSD code' },
  { id: 'qr', name: 'QR Code', description: 'Scan to pay' }
] as const;

export const REFERENCE_PATTERNS = {
  SECURE_BACKEND: /^txn_\d+_[a-f0-9-]{36}$/,
  LEGACY_FRONTEND: /^pay_\d+_[a-z0-9]+$/,
} as const;

export const HEADERS_JSON = {
  'Content-Type': 'application/json'
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];
export type PaymentChannel = typeof PAYMENT_CHANNELS[number]['id'];
export type SupportedCurrency = typeof PAYSTACK_CONFIG.SUPPORTED_CURRENCIES[number];

// Runtime validation functions
export const isValidPaymentReference = (reference: string): boolean => {
  return REFERENCE_PATTERNS.SECURE_BACKEND.test(reference);
};

export const isLegacyReference = (reference: string): boolean => {
  return REFERENCE_PATTERNS.LEGACY_FRONTEND.test(reference);
};

export const validatePaymentAmount = (amount: number, currency: SupportedCurrency = 'NGN'): boolean => {
  if (currency === 'NGN') {
    return amount >= 100 && amount <= 100000000; // ₦100 to ₦100M
  }
  return false;
};

export const formatNairaCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
};

export const convertToKobo = (nairaAmount: number): number => {
  return Math.round(nairaAmount * 100);
};

export const convertFromKobo = (koboAmount: number): number => {
  return koboAmount / 100;
};