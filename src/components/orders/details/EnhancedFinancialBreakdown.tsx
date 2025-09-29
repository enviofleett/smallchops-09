import React from 'react';

interface EnhancedFinancialBreakdownProps {
  order: any;
}

/**
 * Comprehensive financial breakdown showing all cost components
 * Always displays all rows even if values are zero
 */
export const EnhancedFinancialBreakdown: React.FC<EnhancedFinancialBreakdownProps> = ({ order }) => {
  const subtotal = order?.subtotal || 0;
  const vatAmount = order?.vat_amount || 0;
  const deliveryFee = order?.delivery_fee || 0;
  const discountAmount = order?.discount_amount || 0;
  const totalAmount = order?.total_amount || 0;
  const vatRate = order?.vat_rate || 0;

  const breakdownItems = [
    { label: 'Subtotal', value: subtotal, isTotal: false },
    { label: `VAT (${vatRate}%)`, value: vatAmount, isTotal: false },
    { label: 'Delivery Fee', value: deliveryFee, isTotal: false },
    { label: 'Discount', value: discountAmount, isDiscount: true, isTotal: false },
    { label: 'Grand Total', value: totalAmount, isTotal: true },
  ];

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-base text-foreground">Financial Breakdown</h3>
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        {breakdownItems.map((item, index) => (
          <div 
            key={item.label}
            className={`flex justify-between items-center text-sm ${
              item.isTotal 
                ? 'font-semibold text-foreground border-t pt-2 mt-2' 
                : 'text-muted-foreground'
            }`}
          >
            <span>{item.label}</span>
            <span className={item.isDiscount ? 'text-destructive' : ''}>
              {item.isDiscount && item.value > 0 ? '-' : ''}₦{item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};