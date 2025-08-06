// Paystack type definitions for window object
declare global {
  interface Window {
    PaystackPop: PaystackPopConstructor;
  }
}

interface PaystackPopConstructor {
  setup: (config: PaystackConfig) => {
    openIframe: () => void;
  };
}

interface PaystackConfig {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  ref: string;
  channels?: string[];
  metadata?: Record<string, any>;
  callback: (response: PaystackResponse) => void;
  onClose: () => void;
}

interface PaystackResponse {
  status: string;
  reference: string;
  message?: string;
  redirecturl?: string;
  trans?: string;
  transaction?: string;
  trxref?: string;
}

export {};