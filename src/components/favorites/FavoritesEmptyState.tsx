import React from 'react';
import { Heart, Search, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

interface FavoritesEmptyStateProps {
  hasNoFavorites: boolean;
  hasNoFilteredResults: boolean;
  onClearFilters: () => void;
}

export const FavoritesEmptyState: React.FC<FavoritesEmptyStateProps> = ({
  hasNoFavorites,
  hasNoFilteredResults,
  onClearFilters,
}) => {
  if (hasNoFavorites) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Heart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
          <p className="text-muted-foreground mb-6">
            Start adding products to your favorites by clicking the heart icon on any product.
          </p>
          <Button asChild>
            <Link to="/customer-portal">
              <ShoppingBag className="mr-2 h-4 w-4" />
              Browse Menu
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (hasNoFilteredResults) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No results found</h3>
          <p className="text-muted-foreground mb-6">
            No favorites match your current search or filter criteria.
          </p>
          <Button onClick={onClearFilters} variant="outline">
            Clear filters
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
};