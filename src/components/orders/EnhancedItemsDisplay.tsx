import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, DollarSign, TrendingUp, FileText } from 'lucide-react';

interface EnhancedItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  cost_price?: number;
  vat_rate?: number;
  vat_amount?: number;
  discount_amount?: number;
  special_instructions?: string;
  customizations?: any;
  product?: {
    id: string;
    name: string;
    description?: string;
    price: number;
    cost_price?: number;
    image_url?: string;
    category_id?: string;
    features?: any;
    ingredients?: any;
  };
}

interface EnhancedItemsDisplayProps {
  items: EnhancedItem[];
  showFinancialDetails?: boolean;
}

export const EnhancedItemsDisplay: React.FC<EnhancedItemsDisplayProps> = ({ 
  items, 
  showFinancialDetails = false 
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const calculateMargin = (sellingPrice: number, costPrice: number) => {
    if (!costPrice || costPrice === 0) return 0;
    return ((sellingPrice - costPrice) / sellingPrice) * 100;
  };

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items (0)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No items found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Order Items ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id || index} className="border border-border rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* Product Image */}
                {item.product?.image_url && (
                  <div className="flex-shrink-0">
                    <img 
                      src={item.product.image_url} 
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                  </div>
                )}
                
                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-foreground">
                        {item.product?.name || 'Unknown Item'}
                      </h4>
                      {item.product?.description && (
                        <p className="text-sm text-muted-foreground mt-1" 
                           dangerouslySetInnerHTML={{ __html: item.product.description }} />
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.total_price)}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                  </div>

                  {/* Enhanced Details Row */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary">
                      Qty: {item.quantity}
                    </Badge>
                    
                    {item.vat_rate && item.vat_rate > 0 && (
                      <Badge variant="outline">
                        VAT: {item.vat_rate}% ({formatCurrency(item.vat_amount || 0)})
                      </Badge>
                    )}
                    
                    {item.discount_amount && item.discount_amount > 0 && (
                      <Badge variant="destructive">
                        Discount: {formatCurrency(item.discount_amount)}
                      </Badge>
                    )}
                  </div>

                  {/* Financial Details (Admin Only) */}
                  {showFinancialDetails && item.product?.cost_price && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/50 rounded-md">
                      <div>
                        <p className="text-xs text-muted-foreground">Cost Price</p>
                        <p className="font-medium text-sm">{formatCurrency(item.product.cost_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Selling Price</p>
                        <p className="font-medium text-sm">{formatCurrency(item.unit_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Unit Margin</p>
                        <p className="font-medium text-sm flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {calculateMargin(item.unit_price, item.product.cost_price).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Profit</p>
                        <p className="font-medium text-sm text-green-600">
                          {formatCurrency((item.unit_price - item.product.cost_price) * item.quantity)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Product Features */}
                  {item.product?.features && Array.isArray(item.product.features) && item.product.features.length > 0 && (
                    <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                      <span className="font-medium text-primary">What's included:</span>
                      <ul className="mt-1 space-y-0.5">
                        {item.product.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="text-muted-foreground">• {feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Special Instructions */}
                  {item.special_instructions && (
                    <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border-l-4 border-blue-500">
                      <p className="text-sm flex items-start gap-2">
                        <FileText className="h-4 w-4 mt-0.5 text-blue-500" />
                        <span><strong>Instructions:</strong> {item.special_instructions}</span>
                      </p>
                    </div>
                  )}

                  {/* Customizations */}
                  {item.customizations && Object.keys(item.customizations).length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">Customizations:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.customizations).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};