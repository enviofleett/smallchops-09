import React from 'react';
import { getFirstImage, hasImages } from '@/lib/imageUtils';
import { Badge } from '@/components/ui/badge';
import { Package, AlertCircle } from 'lucide-react';

interface CompleteOrderItemsSectionProps {
  items: any[];
}

/**
 * Complete order items section with product images, details, and comprehensive information
 * Shows thumbnails, SKUs, features, and special instructions for each item
 */
export const CompleteOrderItemsSection: React.FC<CompleteOrderItemsSectionProps> = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
          <Package className="h-4 w-4" />
          Order Items (0)
        </h3>
        <div className="bg-muted/50 rounded-lg p-8 text-center">
          <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No items found in this order</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
        <Package className="h-4 w-4" />
        Order Items ({items.length})
      </h3>
      
      <div className="space-y-3">
        {items.map((item, index) => {
          const product = item.product || {};
          const itemImage = getFirstImage(product);
          const hasProductImage = hasImages(product);
          
          return (
            <div key={item.id || index} className="bg-muted/50 rounded-lg p-4">
              <div className="flex gap-4">
                {/* Product Image */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-background border">
                    <img
                      src={itemImage}
                      alt={product.name || item.name || 'Product'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                  {!hasProductImage && (
                    <div className="w-16 h-16 rounded-lg bg-muted border flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Item Details */}
                <div className="flex-1 space-y-2">
                  {/* Product Name and SKU */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">
                        {product.name || item.name || 'Unknown Product'}
                      </h4>
                      {product.id && (
                        <p className="text-xs text-muted-foreground">SKU: {product.id}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-foreground">
                        ₦{(item.total_price || item.unit_price * item.quantity || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ₦{(item.unit_price || 0).toLocaleString()} × {item.quantity}
                      </div>
                    </div>
                  </div>

                  {/* Product Description */}
                  {product.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {/* Product Features/Add-ons */}
                  {product.features && Array.isArray(product.features) && product.features.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {product.features.map((feature: string, featureIndex: number) => (
                        <Badge key={featureIndex} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Customizations */}
                  {item.customizations && (
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Customizations: </span>
                      <span className="text-muted-foreground">{item.customizations}</span>
                    </div>
                  )}

                  {/* Special Instructions */}
                  {item.special_instructions && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Special Instructions</p>
                          <p className="text-sm text-amber-700">{item.special_instructions}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product Ingredients (if available) */}
                  {product.ingredients && Array.isArray(product.ingredients) && product.ingredients.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Ingredients: </span>
                      {product.ingredients.join(', ')}
                    </div>
                  )}

                  {/* Item-level pricing breakdown */}
                  {(item.vat_amount > 0 || item.discount_amount > 0) && (
                    <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
                      {item.discount_amount > 0 && (
                        <div className="flex justify-between">
                          <span>Item Discount:</span>
                          <span className="text-destructive">-₦{item.discount_amount.toLocaleString()}</span>
                        </div>
                      )}
                      {item.vat_amount > 0 && (
                        <div className="flex justify-between">
                          <span>VAT ({item.vat_rate || 0}%):</span>
                          <span>₦{item.vat_amount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};