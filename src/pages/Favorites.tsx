import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { PriceDisplay } from '@/components/ui/price-display';
import { DiscountBadge } from '@/components/ui/discount-badge';
import { useFavorites } from '@/hooks/useFavorites';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';

const Favorites = () => {
  const { favorites, isLoading, removeFavorite, clearAllFavorites, getFavoritesCount } = useFavorites();
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleAddToCart = (favorite: any) => {
    addItem({
      id: favorite.product_id,
      name: favorite.product_name,
      price: favorite.product_price,
      original_price: favorite.product_price,
      discount_amount: 0,
      vat_rate: 7.5,
      image_url: favorite.product_image_url,
    });

    toast({
      title: "Added to Cart",
      description: `${favorite.product_name} has been added to your cart`,
      variant: "default",
    });
  };

  const handleRemoveFavorite = async (productId: string, productName: string) => {
    const success = await removeFavorite(productId);
    if (success) {
      toast({
        title: "Removed from Favorites",
        description: `${productName} has been removed from your favorites`,
        variant: "default",
      });
    }
  };

  const handleClearAll = async () => {
    if (favorites.length === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to remove all ${favorites.length} items from your favorites? This action cannot be undone.`
    );
    
    if (confirmed) {
      const success = await clearAllFavorites();
      if (success) {
        toast({
          title: "Favorites Cleared",
          description: "All items have been removed from your favorites",
          variant: "default",
        });
      }
    }
  };

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: 8 }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <Skeleton className="aspect-square" />
          <CardContent className="p-4">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-4" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-16">
      <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-2xl font-semibold mb-2">No favorites yet</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Start browsing our products and add them to your favorites by clicking the heart icon. 
        Your favorite items will appear here for easy access.
      </p>
      <Button asChild>
        <Link to="/">
          <ShoppingCart className="h-4 w-4 mr-2" />
          Browse Products
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="h-8 w-8 text-red-500" />
              My Favorites
            </h1>
            {getFavoritesCount() > 0 && (
              <p className="text-muted-foreground mt-2">
                {getFavoritesCount()} item{getFavoritesCount() !== 1 ? 's' : ''} in your favorites
              </p>
            )}
          </div>
          
          {favorites.length > 0 && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleClearAll}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : favorites.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {favorites.map((favorite) => (
              <Card 
                key={favorite.favorite_id} 
                className="overflow-hidden hover:shadow-lg transition-all duration-300 group"
              >
                <div className="relative aspect-square overflow-hidden">
                  <Link to={`/product/${favorite.product_id}`}>
                    <img
                      src={favorite.product_image_url || '/placeholder.svg'}
                      alt={favorite.product_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </Link>
                  
                  {/* Remove from favorites button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 bg-white/90 hover:bg-white hover:text-red-500 transition-colors shadow-md"
                    onClick={() => handleRemoveFavorite(favorite.product_id, favorite.product_name)}
                  >
                    <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                  </Button>

                  {/* Product status indicator */}
                  {favorite.product_status !== 'active' && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Badge variant="destructive">
                        {favorite.product_status === 'out_of_stock' ? 'Out of Stock' : 'Unavailable'}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4">
                  <Link to={`/product/${favorite.product_id}`}>
                    <h4 className="font-semibold mb-2 line-clamp-2 hover:text-primary transition-colors">
                      {favorite.product_name}
                    </h4>
                  </Link>
                  
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="text-lg font-bold text-primary">
                        {formatCurrency(favorite.product_price)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Added {new Date(favorite.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleAddToCart(favorite)}
                        disabled={favorite.product_status !== 'active'}
                        className="flex-1"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Add to Cart
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFavorite(favorite.product_id, favorite.product_name)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Back to shopping link */}
        {favorites.length > 0 && (
          <div className="text-center mt-12">
            <Button variant="outline" asChild>
              <Link to="/">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        )}
      </div>
      
      <PublicFooter />
    </div>
  );
};

export default Favorites;