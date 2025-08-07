import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Heart, Star } from 'lucide-react';
import { ProductWithDiscount } from '@/lib/discountCalculations';
import { PriceDisplay } from '@/components/ui/price-display';
import { DiscountBadge } from '@/components/ui/discount-badge';
import { StarRating } from '@/components/ui/star-rating';
import { useProductRatingSummary } from '@/hooks/useProductReviews';

interface DiscountedProductCardProps {
  product: ProductWithDiscount;
  onAddToCart?: (product: ProductWithDiscount) => void;
  onToggleFavorite?: (productId: string) => void;
  isFavorite?: boolean;
  showAddToCart?: boolean;
}

export function DiscountedProductCard({ 
  product, 
  onAddToCart, 
  onToggleFavorite,
  isFavorite = false,
  showAddToCart = true
}: DiscountedProductCardProps) {
  const { data: ratingSummary } = useProductRatingSummary(product.id);
  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-200 group relative overflow-hidden">
      {/* Discount Badge */}
      {product.has_discount && (
        <div className="absolute top-2 left-2 z-10">
          <DiscountBadge discountPercentage={product.discount_percentage} size="sm" />
        </div>
      )}
      
      {/* Favorite Button */}
      {onToggleFavorite && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10 p-1.5 h-auto bg-white/80 hover:bg-white"
          onClick={() => onToggleFavorite(product.id)}
        >
          <Heart 
            className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
          />
        </Button>
      )}

      <CardContent className="p-0 flex flex-col h-full">
        {/* Product Image */}
        <div className="aspect-square relative overflow-hidden bg-muted">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                width: '100%',
                height: '100%',
                display: 'block'
              }}
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = target.parentElement?.querySelector('.fallback-content');
                if (fallback) {
                  (fallback as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          
          {/* Fallback for missing images */}
          <div className={`fallback-content w-full h-full flex items-center justify-center bg-muted text-muted-foreground ${product.image_url ? 'hidden' : 'flex'}`} style={{ display: product.image_url ? 'none' : 'flex' }}>
            No Image
          </div>
          
          {/* Promotion Info Overlay */}
          {product.has_discount && product.active_promotion && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <div className="text-white text-xs font-medium">
                {product.active_promotion.name}
              </div>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            
            {product.categories && (
              <p className="text-xs text-muted-foreground mb-2">
                {product.categories.name}
              </p>
            )}
            
            {product.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {product.description}
              </p>
            )}
            
            {/* Rating Display */}
            <div className="mb-1">
              {ratingSummary && ratingSummary.total_reviews > 0 ? (
                <div className="flex items-center space-x-1">
                  <StarRating rating={ratingSummary.average_rating} size="sm" />
                  <span className="text-xs text-muted-foreground">({ratingSummary.total_reviews})</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <StarRating rating={0} size="sm" />
                  <span className="text-xs text-muted-foreground">(0)</span>
                </div>
              )}
            </div>
          </div>

          {/* Price Section */}
          <div className="space-y-3">
            <PriceDisplay
              originalPrice={product.original_price}
              discountedPrice={product.has_discount ? product.discounted_price : undefined}
              hasDiscount={product.has_discount}
              showSavings={product.has_discount}
              size="sm"
            />
            
            {/* Promotion Details */}
            {product.has_discount && product.active_promotion && (
              <div className="text-xs text-green-600 font-medium">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {product.active_promotion.code && (
                    <span>Code: {product.active_promotion.code}</span>
                  )}
                </div>
                {product.active_promotion.valid_until && (
                  <div className="text-muted-foreground mt-0.5">
                    Valid until {new Date(product.active_promotion.valid_until).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
            
            {/* Action Button */}
            {showAddToCart && onAddToCart && (
              <Button 
                size="sm" 
                className="w-full text-xs"
                onClick={() => onAddToCart(product)}
              >
                <ShoppingCart className="w-3 h-3 mr-1" />
                Add to Cart
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}