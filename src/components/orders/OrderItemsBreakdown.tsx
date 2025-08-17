import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, ShoppingCart, Info } from 'lucide-react';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vat_amount?: number;
  vat_rate?: number;
  discount_amount?: number;
  special_instructions?: string;
  customizations?: any;
}

interface OrderItemsBreakdownProps {
  items: OrderItem[];
  subtotal: number;
  totalVat: number;
  totalDiscount: number;
  grandTotal: number;
  showDetailed?: boolean;
  className?: string;
}

export function OrderItemsBreakdown({ 
  items, 
  subtotal, 
  totalVat, 
  totalDiscount, 
  grandTotal,
  showDetailed = true,
  className = ""
}: OrderItemsBreakdownProps) {
  const formatCurrency = (value: number | string | null | undefined) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(safe);
  };

  const formatCustomizations = (customizations: any) => {
    if (!customizations) return null;
    
    if (typeof customizations === 'string') {
      return customizations;
    }
    
    if (typeof customizations === 'object') {
      return Object.entries(customizations)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    
    return null;
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Order Items ({items.length})</h3>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id || index} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 break-words">{item.product_name}</h4>
                      
                      {showDetailed && formatCustomizations(item.customizations) && (
                        <p className="text-sm text-gray-600 mt-1">
                          <Info className="h-3 w-3 inline mr-1" />
                          {formatCustomizations(item.customizations)}
                        </p>
                      )}
                      
                      {showDetailed && item.special_instructions && (
                        <p className="text-sm text-orange-600 mt-1 italic">
                          Note: {item.special_instructions}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span>Qty: {Number(item.quantity ?? 0)}</span>
                        <span>Unit: {formatCurrency(Number(item.unit_price ?? 0))}</span>
                        {showDetailed && Number(item.discount_amount ?? 0) > 0 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            -{formatCurrency(Number(item.discount_amount ?? 0))} discount
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(Number(item.total_price ?? 0))}
                  </div>
                  {showDetailed && Number(item.vat_amount ?? 0) > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      VAT ({item.vat_rate || 7.5}%): {formatCurrency(Number(item.vat_amount ?? 0))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Totals */}
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Total Discount</span>
              <span className="font-medium text-green-600">-{formatCurrency(totalDiscount)}</span>
            </div>
          )}
          
          {totalVat > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">VAT (7.5%)</span>
              <span className="font-medium">{formatCurrency(totalVat)}</span>
            </div>
          )}
          
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}