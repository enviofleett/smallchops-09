import React from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerFavorites } from '@/hooks/useCustomerFavorites';
import { FavoriteProductGrid } from '@/components/favorites/FavoriteProductGrid';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Heart, 
  AlertTriangle, 
  Grid3X3, 
  List,
  Search,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useState } from 'react';

const ContentSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {[1, 2, 3, 4].map(i => (
      <Card key={i} className="p-4">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Card>
    ))}
  </div>
);

export function EnhancedWishlistSection() {
  const { customerAccount } = useCustomerAuth();
  const { 
    favorites, 
    isLoading: favoritesLoading, 
    error: favoritesError,
    removeFromFavorites 
  } = useCustomerFavorites(customerAccount?.id || '');
  const { handleError } = useErrorHandler();
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [isRemoving, setIsRemoving] = useState(false);

  if (favoritesError) {
    console.error('Favorites error:', favoritesError);
    handleError(favoritesError, 'loading favorites');
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to load wishlist</h3>
        <p className="text-gray-500 mb-4">There was a problem loading your wishlist.</p>
        <Button onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </Card>
    );
  }

  if (favoritesLoading) {
    return <ContentSkeleton />;
  }

  const handleRemoveFromFavorites = async (productId: string) => {
    if (!customerAccount?.id) return;
    
    setIsRemoving(true);
    try {
      await removeFromFavorites({ customerId: customerAccount.id, productId });
    } catch (error) {
      console.error('Error removing favorite:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  // Filter and sort favorites
  const filteredFavorites = favorites
    .filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'newest':
        default:
          return new Date(b.favorited_at).getTime() - new Date(a.favorited_at).getTime();
      }
    });

  // Get unique categories from favorites
  const categories = Array.from(
    new Set(favorites.map(product => product.categories?.name).filter(Boolean))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Wishlist</h2>
          <div className="flex items-center gap-2">
            <p className="text-gray-500">Your favorite items saved for later</p>
            {favorites.length > 0 && (
              <Badge variant="secondary">
                {favorites.length} item{favorites.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        {favorites.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {favorites.length === 0 ? (
        <Card className="p-8 text-center">
          <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
          <p className="text-gray-500 mb-4">Save items you love to your wishlist</p>
          <Button onClick={() => window.location.href = '/products'}>
            Browse Products
          </Button>
        </Card>
      ) : (
        <>
          {/* Filters and Search */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search favorites..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Sort By */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              {filteredFavorites.length} of {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
              {searchTerm && ' matching your search'}
            </p>
          </div>

          {/* Favorites Grid/List */}
          {filteredFavorites.length === 0 ? (
            <Card className="p-8 text-center">
              <Filter className="w-8 h-8 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No favorites found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search terms.</p>
              <Button variant="outline" onClick={() => setSearchTerm('')}>
                Clear Search
              </Button>
            </Card>
          ) : (
            <FavoriteProductGrid
              favorites={filteredFavorites}
              viewMode={viewMode}
              onRemoveFromFavorites={handleRemoveFromFavorites}
              isRemoving={isRemoving}
            />
          )}
        </>
      )}
    </div>
  );
}