import React from 'react';
import { CheckoutErrorMonitor } from './CheckoutErrorMonitor';
import { EnhancedCheckoutFlow } from './EnhancedCheckoutFlow';

// Re-export the enhanced checkout flow wrapped with error monitoring
interface CheckoutFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutFlow: React.FC<CheckoutFlowProps> = ({ isOpen, onClose }) => (
  <CheckoutErrorMonitor>
    <EnhancedCheckoutFlow isOpen={isOpen} onClose={onClose} />
  </CheckoutErrorMonitor>
);