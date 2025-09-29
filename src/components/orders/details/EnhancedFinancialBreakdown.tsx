import React from 'react';
import { AlertCircle, Calculator } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OrderDetailsSectionErrorBoundary } from './ErrorBoundary';
import { FinancialBreakdownSkeleton } from './LoadingSkeleton';

interface EnhancedFinancialBreakdownProps {
  order: any;
  isLoading?: boolean;
}

interface BreakdownItem {
  label: string;
  value: number;
  isTotal?: boolean;
  isDiscount?: boolean;
  description?: string;
}

/**
 * Comprehensive financial breakdown showing all cost components
 * Always displays all rows even if values are zero
 * Enhanced with error handling, loading states, and better formatting
 */
export const EnhancedFinancialBreakdown: React.FC<EnhancedFinancialBreakdownProps> = ({ 
  order, 
  isLoading = false 
}) => {
  // Show loading skeleton if loading
  if (isLoading) {
    return <FinancialBreakdownSkeleton />;
  }

  // Error state if order is missing
  if (!order) {
    return (
      <section className="space-y-3">
        <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Financial Breakdown
        </h3>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Financial information is not available for this order.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  // Safely extract financial data with validation
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : 0;
  const vatAmount = typeof order.vat_amount === 'number' ? order.vat_amount : 0;
  const deliveryFee = typeof order.delivery_fee === 'number' ? order.delivery_fee : 0;
  const discountAmount = typeof order.discount_amount === 'number' ? order.discount_amount : 0;
  const totalAmount = typeof order.total_amount === 'number' ? order.total_amount : 0;
  const vatRate = typeof order.vat_rate === 'number' ? order.vat_rate : 0;

  // Calculate derived values for validation
  const calculatedTotal = subtotal + vatAmount + deliveryFee - discountAmount;
  const hasDiscrepancy = Math.abs(calculatedTotal - totalAmount) > 0.01;

  const breakdownItems: BreakdownItem[] = [
    { 
      label: 'Subtotal', 
      value: subtotal, 
      description: 'Base cost of items before taxes and fees'
    },
    { 
      label: `VAT (${vatRate}%)`, 
      value: vatAmount, 
      description: 'Value Added Tax'
    },
    { 
      label: 'Delivery Fee', 
      value: deliveryFee, 
      description: 'Shipping and handling charges'
    },
    { 
      label: 'Discount', 
      value: discountAmount, 
      isDiscount: true, 
      description: 'Applied discounts and promotions'
    },
    { 
      label: 'Grand Total', 
      value: totalAmount, 
      isTotal: true,
      description: 'Final amount to be paid'
    },
  ];

  // Format currency with proper error handling
  const formatCurrency = (amount: number): string => {
    try {
      return amount.toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return amount.toFixed(2);
    }
  };

  return (
    <OrderDetailsSectionErrorBoundary context="FinancialBreakdown">
      <section className="space-y-3">
        <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Financial Breakdown
        </h3>
        
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          {breakdownItems.map((item, index) => (
            <div 
              key={item.label}
              className={`flex justify-between items-center text-sm ${
                item.isTotal 
                  ? 'font-semibold text-foreground border-t pt-2 mt-2' 
                  : 'text-muted-foreground'
              }`}
              title={item.description}
            >
              <span className="flex-1">{item.label}</span>
              <span 
                className={`font-mono ${
                  item.isDiscount ? 'text-destructive' : 
                  item.isTotal ? 'text-foreground font-semibold' : ''
                }`}
              >
                {item.isDiscount && item.value > 0 ? '-' : ''}₦{formatCurrency(item.value)}
              </span>
            </div>
          ))}

          {/* Show calculation discrepancy warning if exists */}
          {hasDiscrepancy && (
            <Alert className="mt-3 border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="text-xs">
                  <p className="font-medium">Calculation Notice</p>
                  <p>
                    Calculated: ₦{formatCurrency(calculatedTotal)} | 
                    Recorded: ₦{formatCurrency(totalAmount)}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Payment status indicator */}
        {order.payment_status && (
          <div className="text-xs text-muted-foreground">
            Payment Status: <span className={`font-medium ${
              order.payment_status === 'paid' ? 'text-green-600' :
              order.payment_status === 'pending' ? 'text-yellow-600' :
              order.payment_status === 'failed' ? 'text-red-600' :
              'text-muted-foreground'
            }`}>
              {order.payment_status?.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </section>
    </OrderDetailsSectionErrorBoundary>
  );
};