import React, { useState } from 'react';
import { getFirstImage, hasImages, toImagesArray } from '@/lib/imageUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, AlertCircle, ImageIcon, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { OrderDetailsSectionErrorBoundary } from './ErrorBoundary';
import { OrderItemsSkeleton } from './LoadingSkeleton';

interface CompleteOrderItemsSectionProps {
  items: any[];
  isLoading?: boolean;
}

interface ProductImageProps {
  product: any;
  itemName: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Enhanced product image component with fallback and error handling
 */
const ProductImage: React.FC<ProductImageProps> = ({ product, itemName, size = 'md' }) => {
  const [imageError, setImageError] = useState(false);
  const [showAllImages, setShowAllImages] = useState(false);
  
  const images = toImagesArray(product);
  const hasProductImages = images.length > 0;
  const primaryImage = hasProductImages ? images[0] : '/placeholder.svg';
  
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  if (!hasProductImages || imageError) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg bg-muted border flex items-center justify-center`}>
        <Package className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-shrink-0">
      <div className={`${sizeClasses[size]} rounded-lg overflow-hidden bg-background border relative group`}>
        <img
          src={primaryImage}
          alt={product.name || itemName || 'Product'}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          onError={() => setImageError(true)}
          loading="lazy"
        />
        
        {/* Image count indicator */}
        {images.length > 1 && (
          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
            +{images.length - 1}
          </div>
        )}
      </div>
      
      {/* Additional images */}
      {images.length > 1 && (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs p-1"
            onClick={() => setShowAllImages(!showAllImages)}
          >
            {showAllImages ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
            {showAllImages ? 'Hide' : 'Show'} all ({images.length})
          </Button>
          
          {showAllImages && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {images.slice(1, 4).map((image, index) => (
                <div key={index} className="w-8 h-8 rounded border overflow-hidden">
                  <img
                    src={image}
                    alt={`${itemName} ${index + 2}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ))}
              {images.length > 4 && (
                <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center text-xs">
                  +{images.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Complete order items section with product images, details, and comprehensive information
 * Shows thumbnails, SKUs, features, and special instructions for each item
 * Enhanced with error handling, loading states, and better image management
 */
export const CompleteOrderItemsSection: React.FC<CompleteOrderItemsSectionProps> = ({ 
  items, 
  isLoading = false 
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Show loading skeleton if loading
  if (isLoading) {
    return <OrderItemsSkeleton />;
  }

  // Handle missing or empty items
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <OrderDetailsSectionErrorBoundary context="OrderItemsSection">
        <section className="space-y-3">
          <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
            <Package className="h-4 w-4" />
            Order Items (0)
          </h3>
          <Alert>
            <Package className="h-4 w-4" />
            <AlertDescription>
              No items found in this order. This may indicate a data loading issue.
            </AlertDescription>
          </Alert>
        </section>
      </OrderDetailsSectionErrorBoundary>
    );
  }

  // Format currency with error handling
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

  // Toggle item expansion
  const toggleItemExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Validate item data
  const validateItem = (item: any) => {
    const errors = [];
    if (!item.unit_price || typeof item.unit_price !== 'number') {
      errors.push('Missing unit price');
    }
    if (!item.quantity || typeof item.quantity !== 'number') {
      errors.push('Missing quantity');
    }
    if (!item.name && !item.product?.name) {
      errors.push('Missing product name');
    }
    return errors;
  };

  return (
    <OrderDetailsSectionErrorBoundary context="OrderItemsSection">
      <section className="space-y-3">
        <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
          <Package className="h-4 w-4" />
          Order Items ({items.length})
        </h3>
        
        <div className="space-y-3">
          {items.map((item, index) => {
            const itemId = item.id || `item-${index}`;
            const isExpanded = expandedItems.has(itemId);
            const product = item.product || {};
            const validationErrors = validateItem(item);
            const hasValidationErrors = validationErrors.length > 0;
            
            // Safely extract values with defaults
            const itemName = product.name || item.name || 'Unknown Product';
            const unitPrice = typeof item.unit_price === 'number' ? item.unit_price : 0;
            const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
            const totalPrice = typeof item.total_price === 'number' ? 
              item.total_price : (unitPrice * quantity);
            
            return (
              <div key={itemId} className="bg-muted/50 rounded-lg p-4 transition-all duration-200">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <ProductImage 
                    product={product}
                    itemName={itemName}
                    size="md"
                  />

                  {/* Item Details */}
                  <div className="flex-1 space-y-2">
                    {/* Product Name and SKU */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 mr-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">
                            {itemName}
                          </h4>
                          {hasValidationErrors && (
                            <AlertCircle className="h-4 w-4 text-destructive" title="Data validation issues" />
                          )}
                        </div>
                        
                        {/* SKU and Product Code */}
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                          {product.sku && (
                            <span>SKU: <span className="font-mono">{product.sku}</span></span>
                          )}
                          {product.id && product.id !== product.sku && (
                            <span>ID: <span className="font-mono">{product.id}</span></span>
                          )}
                          {product.barcode && (
                            <span>Barcode: <span className="font-mono">{product.barcode}</span></span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-medium text-foreground">
                          ₦{formatCurrency(totalPrice)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ₦{formatCurrency(unitPrice)} × {quantity}
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
                        {product.features.slice(0, isExpanded ? undefined : 3).map((feature: string, featureIndex: number) => (
                          <Badge key={featureIndex} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {product.features.length > 3 && !isExpanded && (
                          <Badge variant="outline" className="text-xs">
                            +{product.features.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Customizations and Add-ons */}
                    {(item.customizations || item.addons) && (
                      <div className="text-sm space-y-1">
                        {item.customizations && (
                          <div>
                            <span className="font-medium text-foreground">Customizations: </span>
                            <span className="text-muted-foreground">{item.customizations}</span>
                          </div>
                        )}
                        {item.addons && Array.isArray(item.addons) && (
                          <div>
                            <span className="font-medium text-foreground">Add-ons: </span>
                            <span className="text-muted-foreground">
                              {item.addons.map((addon: any) => 
                                typeof addon === 'string' ? addon : addon.name || addon.title
                              ).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Special Instructions */}
                    {item.special_instructions && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Special Instructions</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300">{item.special_instructions}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expandable Content */}
                    {(product.ingredients || product.nutritional_info || hasValidationErrors || 
                      (item.vat_amount > 0 || item.discount_amount > 0)) && (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs p-1 mt-2"
                          onClick={() => toggleItemExpansion(itemId)}
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                          {isExpanded ? 'Less details' : 'More details'}
                        </Button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {/* Product Ingredients */}
                            {product.ingredients && Array.isArray(product.ingredients) && product.ingredients.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Ingredients: </span>
                                {product.ingredients.join(', ')}
                              </div>
                            )}

                            {/* Nutritional Info */}
                            {product.nutritional_info && (
                              <div className="text-xs text-muted-foreground">
                                <span className="font-medium">Nutrition: </span>
                                {typeof product.nutritional_info === 'string' ? 
                                  product.nutritional_info : 
                                  JSON.stringify(product.nutritional_info)}
                              </div>
                            )}

                            {/* Item-level pricing breakdown */}
                            {(item.vat_amount > 0 || item.discount_amount > 0) && (
                              <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
                                {item.discount_amount > 0 && (
                                  <div className="flex justify-between">
                                    <span>Item Discount:</span>
                                    <span className="text-destructive">-₦{formatCurrency(item.discount_amount)}</span>
                                  </div>
                                )}
                                {item.vat_amount > 0 && (
                                  <div className="flex justify-between">
                                    <span>VAT ({item.vat_rate || 0}%):</span>
                                    <span>₦{formatCurrency(item.vat_amount)}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Validation Errors for Development */}
                            {hasValidationErrors && process.env.NODE_ENV === 'development' && (
                              <Alert className="mt-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  <div className="text-xs">
                                    <p className="font-medium">Data Issues:</p>
                                    <ul className="list-disc list-inside">
                                      {validationErrors.map((error, idx) => (
                                        <li key={idx}>{error}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </AlertDescription>
                              </Alert>
                            )}
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
    </OrderDetailsSectionErrorBoundary>
  );
};