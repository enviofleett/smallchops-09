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
  product?: {
    id: string;
    name: string;
    description?: string;
    features?: string[] | any;
    ingredients?: string;
    image_url?: string;
    category_id?: string;
  };
  features?: string[] | any;
}

interface OrderItemsBreakdownProps {
  items: OrderItem[];
  subtotal: number;
  totalVat: number;
  totalDiscount: number;
  grandTotal: number;
  deliveryFee?: number;
  showDetailed?: boolean;
  className?: string;
}

export function OrderItemsBreakdown({ 
  items, 
  subtotal, 
  totalVat, 
  totalDiscount, 
  grandTotal,
  deliveryFee = 0,
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

  const renderWhatsIncluded = (item: OrderItem) => {
    // First try to get features from the product object (from detailed query)
    let features = item.product?.features || item.features;
    
    // Handle different data formats - could be array or string
    if (!features) return null;
    
    // If it's a string, try to parse it or split it
    if (typeof features === 'string') {
      // If it looks like JSON, try to parse it
      if (features.startsWith('[') && features.endsWith(']')) {
        try {
          features = JSON.parse(features);
        } catch {
          // If parsing fails, split by common delimiters
          features = features.split(/[,\n]/).map(f => f.trim()).filter(f => f);
        }
      } else {
        // Split by common delimiters
        features = features.split(/[,\n]/).map(f => f.trim()).filter(f => f);
      }
    }
    
    // Ensure we have an array
    if (!Array.isArray(features) || features.length === 0) return null;
    
    return features.map((feature: string, idx: number) => (
      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
        <span className="font-medium text-foreground">{feature.trim()}</span>
      </div>
    ));
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
            <div key={item.id || index} className="border border-border rounded-lg p-4 bg-card/50 hover:bg-card/80 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground break-words mb-1">{item.product_name}</h4>
                      
                      {/* What's Included Details */}
                      {showDetailed && renderWhatsIncluded(item) && (
                        <div className="mb-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <div className="flex items-start gap-2">
                            <Package className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h5 className="text-sm font-semibold text-primary mb-2">What's Included:</h5>
                              <div className="space-y-1">
                                {renderWhatsIncluded(item)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Customizations */}
                      {showDetailed && formatCustomizations(item.customizations) && (
                        <div className="mb-2 p-2 bg-accent/30 rounded border-l-2 border-accent">
                          <p className="text-sm text-accent-foreground flex items-start gap-1">
                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="font-medium">Customizations:</span>
                            <span className="ml-1">{formatCustomizations(item.customizations)}</span>
                          </p>
                        </div>
                      )}
                      
                      {/* Special Instructions */}
                      {showDetailed && item.special_instructions && (
                        <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded">
                          <p className="text-sm text-orange-700 flex items-start gap-1">
                            <span className="text-orange-500 text-base leading-none">📝</span>
                            <span className="font-medium">Special Note:</span>
                            <span className="ml-1 italic">{item.special_instructions}</span>
                          </p>
                        </div>
                      )}
                      
                      {/* Product Details Row */}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Qty:</span>
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                            {Number(item.quantity ?? 0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Unit:</span>
                          <span className="text-foreground">{formatCurrency(Number(item.unit_price ?? 0))}</span>
                        </div>
                        {showDetailed && Number(item.discount_amount ?? 0) > 0 && (
                          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                            <span className="text-green-500 mr-1">💰</span>
                            -{formatCurrency(Number(item.discount_amount ?? 0))} saved
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
        <div className="space-y-3">
          {/* Items Subtotal Breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Items Subtotal ({items.length} items)</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            
            {/* Show individual item totals when there are multiple items */}
            {showDetailed && items.length > 1 && (
              <div className="pl-4 space-y-1 border-l-2 border-gray-100">
                {items.map((item, index) => (
                  <div key={item.id || index} className="flex justify-between text-xs text-gray-500">
                    <span className="truncate mr-2">{item.product_name} (x{item.quantity})</span>
                    <span>{formatCurrency(Number(item.total_price ?? 0))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Discount Section */}
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm bg-green-50 p-2 rounded">
              <span className="text-green-700 font-medium">
                <span className="text-green-600">💰</span> Total Savings
              </span>
              <span className="font-semibold text-green-700">-{formatCurrency(totalDiscount)}</span>
            </div>
          )}
          
          {/* Service Fees Section */}
          <div className="space-y-2">
            {deliveryFee > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <span>🚚</span> Delivery Fee
                  </span>
                  <span className="font-medium">{formatCurrency(deliveryFee)}</span>
                </div>
                <div className="text-xs text-gray-500 pl-6">
                  Standard home delivery within zone
                </div>
              </div>
            )}
            
            {/* Service Charge (if any) */}
            {showDetailed && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Service Charge</span>
                <span className="font-medium text-gray-500">₦0.00</span>
              </div>
            )}
          </div>
          
          {/* Tax Breakdown */}
          {totalVat > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">VAT (7.5%)</span>
                <span className="font-medium">{formatCurrency(totalVat)}</span>
              </div>
              <div className="text-xs text-gray-500 pl-4">
                Value Added Tax calculated on eligible items
              </div>
            </div>
          )}
          
          {/* Calculation Summary */}
          {showDetailed && (
            <div className="bg-blue-50 p-3 rounded space-y-1">
              <div className="text-xs font-medium text-blue-800 mb-2">Order Calculation:</div>
              <div className="space-y-1 text-xs text-blue-700">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Savings:</span>
                    <span>-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span>+{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                {totalVat > 0 && (
                  <div className="flex justify-between">
                    <span>VAT:</span>
                    <span>+{formatCurrency(totalVat)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <Separator className="my-3" />
          
          {/* Final Total */}
          <div className="bg-primary/5 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Order Total</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
            </div>
            
            {/* Total Breakdown Helper */}
            {showDetailed && (totalDiscount > 0 || deliveryFee > 0) && (
              <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-primary/10">
                You pay {formatCurrency(grandTotal)} 
                {totalDiscount > 0 && ` (saved ${formatCurrency(totalDiscount)})`}
                {deliveryFee > 0 && ` including ${formatCurrency(deliveryFee)} delivery`}
              </div>
            )}
          </div>
          
          {/* Payment & Policy Info */}
          <div className="text-xs text-gray-500 mt-3 p-3 bg-gray-50 rounded border">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span>Payment Method:</span>
                <span className="font-medium text-blue-600">Paystack (Secure)</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Currency:</span>
                <span className="font-medium">Nigerian Naira (₦)</span>
              </div>
              <div className="text-xs text-gray-400 mt-2 pt-2 border-t">
                🔒 All transactions are secure and encrypted. Prices include applicable taxes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}