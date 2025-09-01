import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, ShoppingCart, Info } from 'lucide-react';
import { getFirstImage, toImagesArray } from '@/lib/imageUtils';
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
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(safe);
  };
  const formatCustomizations = (customizations: any) => {
    if (!customizations) return null;
    if (typeof customizations === 'string') {
      return customizations;
    }
    if (typeof customizations === 'object') {
      return Object.entries(customizations).filter(([_, value]) => value).map(([key, value]) => `${key}: ${value}`).join(', ');
    }
    return null;
  };
  const renderWhatsIncluded = (item: OrderItem) => {
    // First try to get features from the product object (from detailed query)
    let features = item.product?.features || item.features;

    // Handle different data formats - could be array, string, or object
    if (!features) return null;

    // If it's a string, try to parse it or split it
    if (typeof features === 'string') {
      const trimmed = features.trim();
      if (!trimmed) return null;

      // If it looks like JSON array, try to parse it
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          features = JSON.parse(trimmed);
        } catch {
          // If parsing fails, split by common delimiters
          features = trimmed.split(/[,\n;|]/).map(f => f.trim()).filter(f => f);
        }
      } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        // Handle JSON objects
        try {
          const parsed = JSON.parse(trimmed);
          features = Object.values(parsed).filter(Boolean);
        } catch {
          features = [trimmed];
        }
      } else {
        // Split by common delimiters
        features = trimmed.split(/[,\n;|]/).map(f => f.trim()).filter(f => f);
      }
    }

    // Handle objects (convert values to array)
    if (typeof features === 'object' && !Array.isArray(features)) {
      features = Object.values(features).filter(Boolean);
    }

    // Ensure we have an array with valid content
    if (!Array.isArray(features) || features.length === 0) return null;
    return features.map((feature: string, idx: number) => <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-1 h-1 bg-primary rounded-full flex-shrink-0" />
        <span className="font-medium text-foreground">{String(feature).trim()}</span>
      </div>);
  };
  const renderIngredients = (item: OrderItem) => {
    const ingredients = item.product?.ingredients;
    if (!ingredients || typeof ingredients !== 'string') return null;
    return <div className="mb-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h5 className="text-sm font-semibold text-orange-800 mb-1">Ingredients:</h5>
            <p className="text-xs text-orange-700">{ingredients}</p>
          </div>
        </div>
      </div>;
  };
  return <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Order Items ({items.length})</h3>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {items.map((item, index) => <div key={item.id || index} className="border border-border rounded-lg p-4 bg-card/50 hover:bg-card/80 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    {item.product?.image_url ? <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/20">
                        <img src={getFirstImage(item.product)} alt={item.product_name} className="w-full h-full object-cover" onError={e => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }} />
                        <div className="hidden w-full h-full bg-primary/10 rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                      </div> : <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
                        <Package className="h-5 w-5 text-primary" />
                      </div>}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground break-words mb-1">{item.product_name}</h4>
                      
                      {/* What's Included Details */}
                      {showDetailed && renderWhatsIncluded(item) && <div className="mb-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <div className="flex items-start gap-2">
                            <Package className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h5 className="text-sm font-semibold text-primary mb-2">What's Included:</h5>
                              <div className="space-y-1">
                                {renderWhatsIncluded(item)}
                              </div>
                            </div>
                          </div>
                        </div>}
                      
                      {/* Ingredients */}
                      {showDetailed && renderIngredients(item)}
                      
                      {/* Customizations */}
                      {showDetailed && formatCustomizations(item.customizations) && <div className="mb-2 p-2 bg-accent/30 rounded border-l-2 border-accent">
                          <p className="text-sm text-accent-foreground flex items-start gap-1">
                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="font-medium">Customizations:</span>
                            <span className="ml-1">{formatCustomizations(item.customizations)}</span>
                          </p>
                        </div>}
                      
                      {/* Special Instructions */}
                      {showDetailed && item.special_instructions && <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded">
                          <p className="text-sm text-orange-700 flex items-start gap-1">
                            <span className="text-orange-500 text-base leading-none">📝</span>
                            <span className="font-medium">Special Note:</span>
                            <span className="ml-1 italic">{item.special_instructions}</span>
                          </p>
                        </div>}
                      
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
                        {showDetailed && Number(item.discount_amount ?? 0) > 0 && <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                            <span className="text-green-500 mr-1">💰</span>
                            -{formatCurrency(Number(item.discount_amount ?? 0))} saved
                          </Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>)}
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
            {showDetailed && items.length > 1 && <div className="pl-4 space-y-1 border-l-2 border-gray-100">
                {items.map((item, index) => <div key={item.id || index} className="flex justify-between text-xs text-gray-500">
                    <span className="truncate mr-2">{item.product_name} (x{item.quantity})</span>
                    <span>{formatCurrency(Number(item.total_price ?? 0))}</span>
                  </div>)}
              </div>}
          </div>
          
          {/* Discount Section */}
          {totalDiscount > 0 && <div className="flex justify-between text-sm bg-green-50 p-2 rounded">
              <span className="text-green-700 font-medium">
                <span className="text-green-600">💰</span> Total Savings
              </span>
              <span className="font-semibold text-green-700">-{formatCurrency(totalDiscount)}</span>
            </div>}
          
          {/* Service Fees Section */}
          <div className="space-y-2">
            {deliveryFee > 0 && <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 flex items-center gap-1">
                    <span>🚚</span> Delivery Fee
                  </span>
                  <span className="font-medium">{formatCurrency(deliveryFee)}</span>
                </div>
                <div className="text-xs text-gray-500 pl-6">
                  Standard home delivery within zone
                </div>
              </div>}
            
            {/* Service Charge (if any) */}
            {showDetailed}
          </div>
          
          {/* Tax Breakdown */}
          {totalVat > 0 && <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">VAT (7.5%)</span>
                <span className="font-medium">{formatCurrency(totalVat)}</span>
              </div>
              <div className="text-xs text-gray-500 pl-4">
                Value Added Tax calculated on eligible items
              </div>
            </div>}
          
          {/* Calculation Summary - Responsive Container */}
          {showDetailed}
          
          <Separator className="my-3 sm:my-4" />
          
          {/* Final Total - Enhanced Responsive Design */}
          <div className="bg-primary/5 dark:bg-primary/10 p-3 sm:p-4 lg:p-5 rounded-lg border border-primary/20 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 min-w-0">
              <span className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">
                Order Total
              </span>
              <span className="text-lg sm:text-xl lg:text-2xl font-bold text-primary break-all text-right w-full sm:w-auto">
                {formatCurrency(grandTotal)}
              </span>
            </div>
            
            {/* Total Breakdown Helper - Mobile Optimized */}
            {showDetailed && (totalDiscount > 0 || deliveryFee > 0) && <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 sm:mt-3 pt-2 border-t border-primary/10">
                <div className="flex flex-col gap-1">
                  <span className="break-words">You pay {formatCurrency(grandTotal)}</span>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {totalDiscount > 0 && <span className="text-green-600 dark:text-green-400 break-words">
                        (saved {formatCurrency(totalDiscount)})
                      </span>}
                    {deliveryFee > 0 && <span className="break-words">including {formatCurrency(deliveryFee)} delivery</span>}
                  </div>
                </div>
              </div>}
          </div>
          
          {/* Payment & Policy Info - Fully Responsive */}
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="space-y-2 sm:space-y-3">
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 min-w-0">
                  <div className="flex justify-between sm:justify-start items-center gap-2 min-w-0">
                    <span className="flex-shrink-0">Payment Method:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400 truncate">
                      Paystack (Secure)
                    </span>
                  </div>
                  <div className="flex justify-between sm:justify-start items-center gap-2 min-w-0">
                    <span className="flex-shrink-0">Currency:</span>
                    <span className="font-medium truncate">Nigerian Naira (₦)</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-2 break-words">
                  <span className="flex-shrink-0">🔒</span>
                  <span className="leading-relaxed">
                    All transactions are secure and encrypted. Prices include applicable taxes.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>;
}