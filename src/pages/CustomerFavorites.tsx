import React, { useState } from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerFavorites } from '@/hooks/useCustomerFavorites';
import { FavoriteProductGrid } from '@/components/favorites/FavoriteProductGrid';
import { FavoritesHeader } from '@/components/favorites/FavoritesHeader';
import { FavoritesEmptyState } from '@/components/favorites/FavoritesEmptyState';
import { NotificationPreferences } from '@/components/favorites/NotificationPreferences';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const CustomerFavorites = () => {
  const { customerAccount } = useCustomerAuth();
  const { favorites, isLoading, removeFromFavorites, isRemovingFavorite } = useCustomerFavorites(customerAccount?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  // Filter favorites based on search and category
  const filteredFavorites = favorites.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.categories?.id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories from favorites
  const categories = Array.from(
    new Set(favorites.map(p => p.categories).filter(Boolean))
  ).map(cat => ({ id: cat!.id, name: cat!.name }));

  if (!customerAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Please log in</h2>
            <p className="text-muted-foreground">You need to be logged in to view your favorites.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <FavoritesHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          favoritesCount={favorites.length}
          onShowNotificationSettings={() => setShowNotificationSettings(true)}
        />

        {showNotificationSettings && (
          <NotificationPreferences
            customerId={customerAccount.id}
            onClose={() => setShowNotificationSettings(false)}
          />
        )}

        {filteredFavorites.length === 0 ? (
          <FavoritesEmptyState 
            hasNoFavorites={favorites.length === 0}
            hasNoFilteredResults={favorites.length > 0 && filteredFavorites.length === 0}
            onClearFilters={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
          />
        ) : (
          <FavoriteProductGrid
            favorites={filteredFavorites}
            viewMode={viewMode}
            onRemoveFromFavorites={(productId) => removeFromFavorites({ customerId: customerAccount.id, productId })}
            isRemoving={isRemovingFavorite}
          />
        )}
      </div>
    </div>
  );
};

export default CustomerFavorites;