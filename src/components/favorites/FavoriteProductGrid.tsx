import React from 'react';
import { FavoriteProduct } from '@/api/favorites';
import { FavoriteProductCard } from '@/components/products/FavoriteProductCard';
import { useCart } from '@/hooks/useCart';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

interface FavoriteProductGridProps {
  favorites: FavoriteProduct[];
  viewMode: 'grid' | 'list';
  onRemoveFromFavorites: (productId: string) => void;
  isRemoving: boolean;
}

export const FavoriteProductGrid: React.FC<FavoriteProductGridProps> = ({
  favorites,
  viewMode,
  onRemoveFromFavorites,
  isRemoving,
}) => {
  const { addItem } = useCart();
  const { customerAccount } = useCustomerAuth();

  const handleAddToCart = (product: FavoriteProduct) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      vat_rate: 7.5, // Default VAT rate
      image_url: product.image_url,
    });
  };

  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {favorites.map((product) => (
          <div key={product.id} className="border rounded-lg p-4">
            <div className="flex items-center gap-4">
              <img
                src={product.image_url || '/placeholder.svg'}
                alt={product.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-muted-foreground text-sm line-clamp-2">
                  {product.description}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-lg font-bold">₦{product.price.toLocaleString()}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                    >
                      Add to Cart
                    </button>
                    <button
                      onClick={() => onRemoveFromFavorites(product.id)}
                      disabled={isRemoving}
                      className="px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {favorites.map((product) => (
        <FavoriteProductCard
          key={product.id}
          product={product}
          onRemoveFromFavorites={onRemoveFromFavorites}
          onAddToCart={handleAddToCart}
          isRemoving={isRemoving}
        />
      ))}
    </div>
  );
};