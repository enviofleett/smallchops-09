import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { CartItem } from '@/hooks/useCart';
import { PriceDisplay } from '@/components/ui/price-display';
import { formatCurrency } from '@/lib/discountCalculations';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const hasDiscount = item.original_price && item.discount_amount && item.original_price > item.price;
  const lineTotal = item.price * item.quantity;
  const originalLineTotal = item.original_price ? item.original_price * item.quantity : lineTotal;
  const savings = originalLineTotal - lineTotal;

  return (
    <div className="flex items-start gap-4">
      {/* Product Image */}
      <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
        <img 
          src={item.image_url || '/placeholder.svg'} 
          alt={item.product_name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-base mb-1">{item.product_name}</h4>
        
        {/* Price Display */}
        <div className="mb-2">
          <PriceDisplay
            originalPrice={item.original_price || item.price}
            discountedPrice={hasDiscount ? item.price : undefined}
            hasDiscount={hasDiscount}
            size="sm"
          />
        </div>

        {/* Stock Status */}
        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
          In Stock
        </Badge>
        
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
      
      {/* Right Side - Quantity, Price, Remove */}
      <div className="flex items-center gap-6">
        {/* Quantity Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            disabled={item.quantity <= 1}
          >
            <Minus className="h-3 w-3" />
          </Button>
          
          <span className="w-8 text-center text-sm font-medium">
            {item.quantity}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        
        {/* Line Total */}
        <div className="text-right min-w-[80px]">
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
  );
}