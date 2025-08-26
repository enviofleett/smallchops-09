import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { FavoriteProduct } from '@/api/favorites';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import { toImagesArray } from '@/lib/imageUtils';

interface FavoriteProductCardProps {
  product: FavoriteProduct;
  onRemoveFromFavorites: (productId: string) => void;
  onAddToCart?: (product: FavoriteProduct) => void;
  isRemoving?: boolean;
}

export const FavoriteProductCard = ({ 
  product, 
  onRemoveFromFavorites, 
  onAddToCart,
  isRemoving = false 
}: FavoriteProductCardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col h-full">
        {/* Product Image */}
        <div className="mb-3">
          <ProductImageGallery
            images={toImagesArray(product)}
            alt={product.name}
            containerClassName="aspect-square rounded-lg"
          />
        </div>

        {/* Product Info */}
        <div className="flex-1 flex flex-col">
          <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
          
          {product.categories && (
            <p className="text-xs text-muted-foreground mb-2">{product.categories.name}</p>
          )}
          
          {product.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
          )}

          <div className="mt-auto">
            <p className="font-bold text-primary mb-3">{formatCurrency(product.price)}</p>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              {onAddToCart && (
                <Button 
                  size="sm" 
                  className="flex-1 text-xs"
                  onClick={() => onAddToCart(product)}
                >
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  Add to Cart
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs"
                onClick={() => onRemoveFromFavorites(product.id)}
                disabled={isRemoving}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};