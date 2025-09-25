import React from 'react';
import { Button } from '@/components/ui/button';

interface OrderDetailsFooterProps {
  onClose: () => void;
}

/**
 * OrderDetailsFooter component provides modal action buttons for closing and help
 * 
 * @param onClose - Function to handle modal close action
 * 
 * @example
 * ```tsx
 * const handleClose = () => {
 *   console.log('Closing modal');
 *   setModalOpen(false);
 * };
 * 
 * <OrderDetailsFooter onClose={handleClose} />
 * ```
 */
export const OrderDetailsFooter: React.FC<OrderDetailsFooterProps> = ({ onClose }) => {
  return (
    <div className="flex justify-end border-t px-6 py-4 gap-3">
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
      <Button variant="ghost">
        Help
      </Button>
    </div>
  );
};