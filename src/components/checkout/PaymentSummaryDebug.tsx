import React from 'react';
import { Card } from '@/components/ui/card';

interface PaymentSummaryDebugProps {
  cart: any;
  deliveryFee: number;
  appliedDiscount?: any;
}

export const PaymentSummaryDebug: React.FC<PaymentSummaryDebugProps> = ({ 
  cart, 
  deliveryFee, 
  appliedDiscount 
}) => {
  const finalAmount = cart.summary.total_amount + deliveryFee;
  
  return (
    <Card className="bg-yellow-50 border-yellow-200 p-4 mb-4">
      <h3 className="font-bold mb-2 text-sm text-yellow-800">Payment Debug Info:</h3>
      <div className="space-y-1 text-xs text-yellow-700">
        <div>Subtotal: ₦{cart.summary.subtotal.toFixed(2)}</div>
        <div>Discount: -₦{cart.summary.discount_amount.toFixed(2)} 
          {appliedDiscount && ` (${appliedDiscount.code})`}
        </div>
        <div>After Discount: ₦{cart.summary.total_amount.toFixed(2)}</div>
        <div>Delivery Fee: ₦{deliveryFee.toFixed(2)}</div>
        <div className="font-bold">Final Total: ₦{finalAmount.toFixed(2)}</div>
        <div className="text-gray-600">Paystack Amount: {Math.round(finalAmount * 100)} kobo</div>
      </div>
    </Card>
  );
};