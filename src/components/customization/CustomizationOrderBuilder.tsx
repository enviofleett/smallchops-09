import React from 'react';
import { X, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCustomizationBuilder } from '@/hooks/useCustomizationBuilder';
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
  const { items, updateQuantity, removeItem, clearBuilder, getBundle, isEmpty } = useCustomizationBuilder();
  const { addItem } = useCart();
  const { toast } = useToast();

  const bundle = getBundle();

  const handleAddBundleToCart = () => {
    if (isEmpty) return;

    // Create a bundle item for the main cart
    const bundleItem = {
      id: `custom-bundle-${Date.now()}`,
      name: `Custom Bundle (${bundle.itemCount} items)`,
      price: bundle.totalAmount,
      original_price: bundle.totalOriginalAmount,
      discount_amount: bundle.totalDiscount,
      vat_rate: 7.5,
      image_url: items[0]?.image_url,
      customization_items: items, // Store individual items as metadata
    };

    addItem(bundleItem);
    clearBuilder();
    onClose();

    toast({
      title: "Bundle added to cart",
      description: `Your custom bundle with ${bundle.itemCount} items has been added to cart.`,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed right-0 top-0 h-full w-96 bg-white border-l shadow-lg z-50 transform transition-transform">
        <Card className="h-full rounded-none border-0">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Custom Order</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-0 flex flex-col h-full">
            <ScrollArea className="flex-1 p-4">
              {isEmpty ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="mx-auto h-12 w-12 mb-3 opacity-50" />
                  <p>Start adding items to your custom order</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <img
                        src={item.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=50&h=50&fit=crop'}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{item.name}</h4>
                        <PriceDisplay
                          originalPrice={item.original_price}
                          discountedPrice={item.price}
                          hasDiscount={item.discount_amount > 0}
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="h-6 w-6 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="h-6 w-6 p-0"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="h-6 w-6 p-0 ml-2 text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {!isEmpty && (
              <div className="border-t p-4 space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Items ({bundle.itemCount})</span>
                    <span>₦{bundle.totalOriginalAmount.toFixed(2)}</span>
                  </div>
                  {bundle.totalDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₦{bundle.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total</span>
                    <span>₦{bundle.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
                <Button onClick={handleAddBundleToCart} className="w-full">
                  Add Bundle to Cart
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile bottom sheet */}
      <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={onClose}>
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-lg max-h-[80vh] transform transition-transform"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="rounded-t-lg border-0">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Custom Order</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <ScrollArea className="max-h-96 p-4">
                {isEmpty ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="mx-auto h-12 w-12 mb-3 opacity-50" />
                    <p>Start adding items to your custom order</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <img
                          src={item.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=50&h=50&fit=crop'}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate">{item.name}</h4>
                          <PriceDisplay
                            originalPrice={item.original_price}
                            discountedPrice={item.price}
                            hasDiscount={item.discount_amount > 0}
                            size="sm"
                          />
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="h-6 w-6 p-0"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            className="h-6 w-6 p-0 ml-2 text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {!isEmpty && (
                <div className="border-t p-4 space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Items ({bundle.itemCount})</span>
                      <span>₦{bundle.totalOriginalAmount.toFixed(2)}</span>
                    </div>
                    {bundle.totalDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-₦{bundle.totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total</span>
                      <span>₦{bundle.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <Button onClick={handleAddBundleToCart} className="w-full">
                    Add Bundle to Cart
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};