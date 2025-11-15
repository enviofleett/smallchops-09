import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { CartItem } from '@/hooks/useCart';
import { PriceDisplay } from '@/components/ui/price-display';
import { MOQBadge } from '@/components/ui/moq-badge';
import { formatCurrency } from '@/lib/discountCalculations';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState(String(item.quantity));
  
  const hasDiscount = item.original_price && item.discount_amount && item.original_price > item.price;
  const lineTotal = item.price * item.quantity;
  const originalLineTotal = item.original_price ? item.original_price * item.quantity : lineTotal;
  const savings = originalLineTotal - lineTotal;
  const moq = item.minimum_order_quantity || 1;
  const isMOQViolated = item.quantity < moq;

  // Handle manual quantity input
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty input for better UX
    if (value === '') {
      setInputValue('');
      return;
    }
    
    // Allow only numeric input
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue === '') return;
    
    setInputValue(numericValue);
  };

  // Validate and update quantity on blur
  const handleQuantityBlur = () => {
    const parsedValue = parseInt(inputValue, 10);
    const maxQty = item.stock_quantity || 1000;
    
    // Handle empty or invalid input
    if (inputValue === '' || isNaN(parsedValue) || parsedValue === 0) {
      setInputValue(String(moq));
      onUpdateQuantity(item.id, moq);
      toast({
        title: "Quantity adjusted",
        description: `Minimum order quantity is ${moq}`,
        variant: "default"
      });
      return;
    }
    
    // Enforce minimum quantity
    if (parsedValue < moq) {
      setInputValue(String(moq));
      onUpdateQuantity(item.id, moq);
      toast({
        title: "Quantity adjusted",
        description: `Minimum order quantity is ${moq}`,
        variant: "default"
      });
      return;
    }
    
    // Enforce stock limit
    if (parsedValue > maxQty) {
      setInputValue(String(maxQty));
      onUpdateQuantity(item.id, maxQty);
      toast({
        title: "Quantity adjusted",
        description: `Only ${maxQty} units available in stock`,
        variant: "default"
      });
      return;
    }
    
    // Valid quantity
    if (parsedValue !== item.quantity) {
      onUpdateQuantity(item.id, parsedValue);
    }
  };

  // Handle Plus button click
  const handleIncrement = () => {
    const maxQty = item.stock_quantity || 1000;
    const newQty = Math.min(maxQty, item.quantity + 1);
    
    if (newQty === item.quantity) {
      toast({
        title: "Stock limit reached",
        description: `Only ${maxQty} units available`,
        variant: "default"
      });
      return;
    }
    
    setInputValue(String(newQty));
    onUpdateQuantity(item.id, newQty);
  };

  // Sync input value when item.quantity changes externally
  if (String(item.quantity) !== inputValue && document.activeElement?.getAttribute('data-cart-item-id') !== item.id) {
    setInputValue(String(item.quantity));
  }

  return (
    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
      {/* Mobile: Product Info First */}
      <div className="sm:hidden w-full">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
            <img 
              src={item.image_url || '/placeholder.svg'} 
              alt={item.product_name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm mb-1 leading-tight">{item.product_name}</h4>
            <div className="mb-2">
              <PriceDisplay
                originalPrice={item.original_price || item.price}
                discountedPrice={hasDiscount ? item.price : undefined}
                hasDiscount={hasDiscount}
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Product Image */}
      <div className="hidden sm:block w-20 h-20 md:w-16 md:h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
        <img 
          src={item.image_url || '/placeholder.svg'} 
          alt={item.product_name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Desktop: Product Info */}
      <div className="hidden sm:block flex-1 min-w-0 pr-2">
        <h4 className="font-medium text-base md:text-sm mb-1 leading-tight">{item.product_name}</h4>
        
        {/* Price Display */}
        <div className="mb-2">
          <PriceDisplay
            originalPrice={item.original_price || item.price}
            discountedPrice={hasDiscount ? item.price : undefined}
            hasDiscount={hasDiscount}
            size="sm"
          />
        </div>

        {/* Stock Status and MOQ */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
            In Stock
          </Badge>
          {moq > 1 && (
            <MOQBadge 
              minimumQuantity={moq}
              currentQuantity={item.quantity}
              variant={isMOQViolated ? 'warning' : 'success'}
              className="text-xs"
            />
          )}
        </div>
        
        {/* Customizations */}
        {item.customizations && Object.keys(item.customizations).length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            {Object.entries(item.customizations).map(([key, value]) => (
              <div key={key}>
                {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
              </div>
            ))}
          </div>
        )}
        
        {/* Special Instructions */}
        {item.special_instructions && (
          <div className="mt-1 text-xs text-muted-foreground italic">
            Note: {item.special_instructions}
          </div>
        )}
      </div>
      
      {/* Mobile: Stock Status and MOQ */}
      <div className="sm:hidden w-full">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
            In Stock
          </Badge>
          {moq > 1 && (
            <MOQBadge 
              minimumQuantity={moq}
              currentQuantity={item.quantity}
              variant={isMOQViolated ? 'warning' : 'success'}
              className="text-xs"
            />
          )}
        </div>
        
        {/* Mobile: Customizations */}
        {item.customizations && Object.keys(item.customizations).length > 0 && (
          <div className="mb-2 text-xs text-muted-foreground">
            {Object.entries(item.customizations).map(([key, value]) => (
              <div key={key}>
                {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
              </div>
            ))}
          </div>
        )}
        
        {/* Mobile: Special Instructions */}
        {item.special_instructions && (
          <div className="mb-3 text-xs text-muted-foreground italic">
            Note: {item.special_instructions}
          </div>
        )}
      </div>
      
      {/* Controls Row - Mobile Full Width, Desktop Right Side */}
      <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6">
        {/* Mobile: Quantity and Total Price Row */}
        <div className="sm:hidden flex items-center justify-between">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= moq}
            >
              <Minus className="h-3 w-3" />
            </Button>
            
            <Input
              type="text"
              inputMode="numeric"
              value={inputValue}
              onChange={handleQuantityChange}
              onBlur={handleQuantityBlur}
              data-cart-item-id={item.id}
              className="h-8 w-12 text-center border-input focus-visible:ring-1 focus-visible:ring-ring text-sm font-medium px-1"
              placeholder={String(moq)}
            />
            
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleIncrement}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Mobile: Price and Remove */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-semibold text-base">
                {formatCurrency(lineTotal)}
              </div>
              
              {hasDiscount && savings > 0 && (
                <div className="text-xs text-green-600">
                  Save {formatCurrency(savings)}
                </div>
              )}
              
              {hasDiscount && (
                <div className="text-xs text-muted-foreground line-through">
                  {formatCurrency(originalLineTotal)}
                </div>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Desktop: Quantity Controls and Actions */}
        <div className="hidden sm:flex items-center gap-3 md:gap-6">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= moq}
            >
              <Minus className="h-3 w-3" />
            </Button>
            
            <Input
              type="text"
              inputMode="numeric"
              value={inputValue}
              onChange={handleQuantityChange}
              onBlur={handleQuantityBlur}
              data-cart-item-id={item.id}
              className="h-8 w-12 text-center border-input focus-visible:ring-1 focus-visible:ring-ring text-sm font-medium px-1"
              placeholder={String(moq)}
            />
            
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleIncrement}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Desktop Layout: Price */}
          <div className="hidden sm:block text-right min-w-[80px]">
            <div className="font-semibold text-base">
              {formatCurrency(lineTotal)}
            </div>
            
            {hasDiscount && savings > 0 && (
              <div className="text-xs text-green-600">
                Save {formatCurrency(savings)}
              </div>
            )}
            
            {hasDiscount && (
              <div className="text-xs text-muted-foreground line-through">
                {formatCurrency(originalLineTotal)}
              </div>
            )}
          </div>
          
          {/* Remove Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}