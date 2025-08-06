import React, { useState } from 'react';
import { X, Plus, Minus, ShoppingCart, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCustomizationContext } from '@/context/CustomizationContext';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { PriceDisplay } from '@/components/ui/price-display';

interface CustomizationOrderBuilderProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizationOrderBuilder: React.FC<CustomizationOrderBuilderProps> = ({
  isOpen,
  onClose,
}) => {
  const { items, updateQuantity, removeItem, clearBuilder, getBundle, isEmpty } = useCustomizationContext();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const bundle = getBundle();

  const handleAddBundleToCart = async () => {
    if (isEmpty) {
      toast({
        title: "No items in custom order",
        description: "Please add items to your custom order before proceeding.",
        variant: "destructive",
      });
      return;
    }

    if (bundle.itemCount < 1) {
      toast({
        title: "Minimum order required",
        description: "Please add at least one item to your custom order.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingToCart(true);

    try {
      // Create a bundle item for the main cart
      const bundleItem = {
        id: `custom-bundle-${Date.now()}`,
        name: `Custom Bundle (${bundle.itemCount} items)`,
        price: bundle.totalAmount,
        original_price: bundle.totalOriginalAmount,
        discount_amount: bundle.totalDiscount,
        vat_rate: 7.5,
        image_url: items[0]?.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=300&h=300&fit=crop',
        customization_items: items, // Store individual items as metadata
        type: 'customization_bundle', // Mark as customization bundle
      };

      addItem(bundleItem);
      clearBuilder();
      onClose();

      toast({
        title: "Bundle added to cart",
        description: `Your custom bundle with ${bundle.itemCount} items has been added to cart.`,
      });
    } catch (error) {
      console.error('Error adding bundle to cart:', error);
      toast({
        title: "Error adding to cart",
        description: "There was a problem adding your bundle to cart. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Desktop compact floating sidebar - 50% smaller */}
      <div className="hidden lg:block lg:fixed lg:right-4 lg:top-24 lg:bottom-20 lg:w-72 lg:bg-white lg:border lg:shadow-xl lg:z-40 lg:rounded-lg lg:overflow-hidden">
        <div className="h-full flex flex-col max-h-[calc(100vh-11rem)]">
          <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
            <h2 className="text-base font-semibold text-primary">Custom Order</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 hover:bg-primary/10"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              {isEmpty ? (
                <div className="text-center py-6 text-muted-foreground">
                  <ShoppingCart className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  <h3 className="text-sm font-medium mb-1">Empty order</h3>
                  <p className="text-xs">Add items to customize</p>
                </div>
              ) : (
                <>
                  <div className="mb-2">
                    <Alert className="border-primary/20 bg-primary/5 p-2">
                      <AlertCircle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        Review quantities before adding to cart
                      </AlertDescription>
                    </Alert>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start space-x-2 p-2 border rounded-md bg-white hover:bg-muted/20 transition-colors">
                        <img
                          src={item.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=40&h=40&fit=crop'}
                          alt={item.name}
                          className="w-8 h-8 object-cover rounded flex-shrink-0"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-xs mb-1 leading-tight line-clamp-1">{item.name}</h4>
                          <div className="mb-2">
                            <PriceDisplay
                              originalPrice={item.original_price}
                              discountedPrice={item.price}
                              hasDiscount={item.discount_amount > 0}
                              size="sm"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="h-5 w-5 p-0 hover:bg-destructive/10"
                                disabled={item.quantity <= 1}
                                aria-label={`Decrease quantity of ${item.name}`}
                              >
                                <Minus className="h-2 w-2" />
                              </Button>
                              <span className="text-xs w-6 text-center font-medium bg-muted/50 rounded px-1">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="h-5 w-5 p-0 hover:bg-primary/10"
                                aria-label={`Increase quantity of ${item.name}`}
                              >
                                <Plus className="h-2 w-2" />
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                              className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10"
                              aria-label={`Remove ${item.name} from order`}
                            >
                              <X className="h-2 w-2" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Desktop Footer - Compact sticky bottom */}
            {!isEmpty && (
              <div className="border-t bg-gradient-to-r from-muted/10 to-muted/20 p-3 space-y-3 rounded-b-lg">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Items ({bundle.itemCount})</span>
                    <span className="font-medium">₦{bundle.totalOriginalAmount.toFixed(2)}</span>
                  </div>
                  {bundle.totalDiscount > 0 && (
                    <div className="flex justify-between items-center text-xs text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">-₦{bundle.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-semibold text-sm border-t pt-2 border-muted">
                    <span>Total</span>
                    <span className="text-primary">₦{bundle.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
                <Button 
                  onClick={handleAddBundleToCart} 
                  className="w-full h-8 text-xs"
                  disabled={isAddingToCart || isEmpty}
                  size="sm"
                >
                  {isAddingToCart ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding to Cart...
                    </>
                  ) : (
                    `Add Bundle (₦${bundle.totalAmount.toFixed(2)})`
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet - improved responsiveness */}
      <div className="lg:hidden fixed inset-0 z-50 bg-black/50 animate-fade-in" onClick={onClose}>
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl max-h-[85vh] transform transition-transform animate-slide-in-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col h-full max-h-[85vh]">
            {/* Mobile Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/5">
              <h2 className="text-lg font-semibold">Custom Order</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Mobile Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-safe">
              {isEmpty ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="mx-auto h-16 w-16 mb-4 opacity-40" />
                  <h3 className="text-lg font-medium mb-2">Your custom order is empty</h3>
                  <p className="text-sm">Start adding items from the customization menu</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <Alert className="border-primary/20 bg-primary/5">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Review and adjust quantities before adding to cart
                      </AlertDescription>
                    </Alert>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-start space-x-3 p-3 border rounded-lg bg-white">
                        <img
                          src={item.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=60&h=60&fit=crop'}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1 leading-tight">{item.name}</h4>
                          <div className="mb-2">
                            <PriceDisplay
                              originalPrice={item.original_price}
                              discountedPrice={item.price}
                              hasDiscount={item.discount_amount > 0}
                              size="sm"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="h-8 w-8 p-0"
                                disabled={item.quantity <= 1}
                                aria-label={`Decrease quantity of ${item.name}`}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm w-8 text-center font-medium bg-muted/50 rounded px-2 py-1">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="h-8 w-8 p-0"
                                aria-label={`Increase quantity of ${item.name}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                              className="h-8 w-8 p-0 text-destructive"
                              aria-label={`Remove ${item.name} from order`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Mobile Footer - Sticky at bottom */}
            {!isEmpty && (
              <div className="border-t bg-muted/10 p-4 pb-safe space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Items ({bundle.itemCount})</span>
                    <span className="font-medium">₦{bundle.totalOriginalAmount.toFixed(2)}</span>
                  </div>
                  {bundle.totalDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">-₦{bundle.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-semibold text-lg border-t pt-3 border-muted">
                    <span>Total</span>
                    <span className="text-primary">₦{bundle.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
                <Button 
                  onClick={handleAddBundleToCart} 
                  className="w-full h-12"
                  disabled={isAddingToCart || isEmpty}
                  size="lg"
                >
                  {isAddingToCart ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    `Add Bundle (₦${bundle.totalAmount.toFixed(2)})`
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};