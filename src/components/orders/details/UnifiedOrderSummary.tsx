import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Package, ChevronDown, ChevronUp, Info, Calculator, ShoppingCart } from 'lucide-react';
import { getFirstImage } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';

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

interface UnifiedOrderSummaryProps {
  items: OrderItem[];
  subtotal: number;
  totalVat: number;
  totalDiscount: number;
  deliveryFee?: number;
  grandTotal: number;
  vatRate?: number;
  paymentStatus?: string;
}

export const UnifiedOrderSummary: React.FC<UnifiedOrderSummaryProps> = ({
  items,
  subtotal,
  totalVat,
  totalDiscount,
  deliveryFee = 0,
  grandTotal,
  vatRate = 7.5,
  paymentStatus
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const formatCurrency = (value: number | string | null | undefined) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(safe);
  };

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const formatCustomizations = (customizations: any) => {
    if (!customizations) return null;
    if (typeof customizations === 'string') return customizations;
    if (typeof customizations === 'object') {
      return Object.entries(customizations)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    return null;
  };

  const renderFeatures = (item: OrderItem) => {
    let features = item.product?.features || item.features;
    if (!features) return null;

    if (typeof features === 'string') {
      const trimmed = features.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          features = JSON.parse(trimmed);
        } catch {
          features = trimmed.split(/[,\n;|]/).map(f => f.trim()).filter(f => f);
        }
      } else {
        features = trimmed.split(/[,\n;|]/).map(f => f.trim()).filter(f => f);
      }
    }

    if (typeof features === 'object' && !Array.isArray(features)) {
      features = Object.values(features).filter(Boolean);
    }

    if (!Array.isArray(features) || features.length === 0) return null;

    return (
      <div className="space-y-1">
        {features.map((feature: string, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
            <span className="font-medium text-foreground">{String(feature).trim()}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-3 sm:p-6">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Order Summary</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {items.length} {items.length === 1 ? 'Item' : 'Items'}
          </Badge>
        </div>

        {/* Items List */}
        <div className="space-y-2 mb-4">
          {items.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const hasDetails = item.product?.features || item.product?.ingredients || 
                              item.special_instructions || item.customizations;

            return (
              <div key={item.id} className="border rounded-lg overflow-hidden bg-card hover:bg-accent/5 transition-colors">
                {/* Item Summary Row */}
                <div className="p-3 flex items-center gap-3">
                  {/* Product Image */}
                  {item.product?.image_url ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-border">
                      <img 
                        src={getFirstImage(item.product)} 
                        alt={item.product_name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Item Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.product_name}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Qty: <span className="font-medium text-foreground">{item.quantity}</span></span>
                          <span>×</span>
                          <span>{formatCurrency(item.unit_price)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-sm">{formatCurrency(item.total_price)}</div>
                        {item.discount_amount && item.discount_amount > 0 && (
                          <div className="text-xs text-green-600">
                            -{formatCurrency(item.discount_amount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expand Button */}
                  {hasDetails && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleItemExpansion(item.id)}
                      className="h-8 w-8 p-0 flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && hasDetails && (
                  <div className="px-3 pb-3 pt-0 space-y-2 border-t bg-muted/30">
                    {/* Features */}
                    {renderFeatures(item) && (
                      <div className="p-2 bg-primary/5 rounded border border-primary/20">
                        <div className="flex items-start gap-2">
                          <Package className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h5 className="text-xs font-semibold text-primary mb-1">What's Included:</h5>
                            {renderFeatures(item)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ingredients */}
                    {item.product?.ingredients && (
                      <div className="p-2 bg-orange-50 rounded border border-orange-200">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h5 className="text-xs font-semibold text-orange-800 mb-1">Ingredients:</h5>
                            <p className="text-xs text-orange-700">{item.product.ingredients}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Customizations */}
                    {formatCustomizations(item.customizations) && (
                      <div className="p-2 bg-accent/30 rounded border-l-2 border-accent">
                        <p className="text-xs text-accent-foreground flex items-start gap-1">
                          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="font-medium">Customizations:</span>
                          <span className="ml-1">{formatCustomizations(item.customizations)}</span>
                        </p>
                      </div>
                    )}

                    {/* Special Instructions */}
                    {item.special_instructions && (
                      <div className="p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700 flex items-start gap-1">
                          <span className="text-blue-500 text-base leading-none">📝</span>
                          <span className="font-medium">Note:</span>
                          <span className="ml-1 italic">{item.special_instructions}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Separator className="my-4" />

        {/* Financial Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Financial Breakdown</h4>
          </div>

          <div className="space-y-2 text-sm">
            {/* Subtotal */}
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>

            {/* VAT */}
            {totalVat > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>VAT ({vatRate}%)</span>
                <span className="font-medium">{formatCurrency(totalVat)}</span>
              </div>
            )}

            {/* Delivery Fee */}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span>🚚</span> Delivery Fee
                </span>
                <span className="font-medium">{formatCurrency(deliveryFee)}</span>
              </div>
            )}

            {/* Discount */}
            {totalDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <span>💰</span> Discount
                </span>
                <span className="font-medium">-{formatCurrency(totalDiscount)}</span>
              </div>
            )}

            <Separator className="my-2" />

            {/* Grand Total */}
            <div className={cn(
              "flex justify-between items-center p-3 rounded-lg",
              "bg-primary/5 border border-primary/20"
            )}>
              <span className="font-semibold text-base">Order Total</span>
              <span className="font-bold text-lg text-primary">{formatCurrency(grandTotal)}</span>
            </div>

            {/* Payment Status */}
            {paymentStatus && (
              <div className="flex justify-between items-center text-xs pt-2">
                <span className="text-muted-foreground">Payment Status</span>
                <Badge 
                  variant={paymentStatus === 'paid' ? 'default' : 'secondary'}
                  className={cn(
                    paymentStatus === 'paid' && 'bg-green-500 hover:bg-green-600',
                    paymentStatus === 'pending' && 'bg-yellow-500 hover:bg-yellow-600',
                    paymentStatus === 'failed' && 'bg-red-500 hover:bg-red-600'
                  )}
                >
                  {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
                </Badge>
              </div>
            )}
          </div>

          {/* Payment Info Footer */}
          <div className="text-xs text-muted-foreground pt-3 border-t">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0">🔒</span>
              <span className="leading-relaxed">
                All transactions are secure and encrypted. Prices include applicable taxes.
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
