import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, AlertCircle, Search, Filter } from 'lucide-react';

interface EmptyStateProps {
  searchQuery?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

export const OrdersEmptyState: React.FC<EmptyStateProps> = ({
  searchQuery,
  hasFilters,
  onClearFilters,
}) => {
  const hasSearchOrFilters = searchQuery || hasFilters;

  return (
    <Card className="p-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          {hasSearchOrFilters ? (
            <Search className="w-12 h-12 text-muted-foreground" />
          ) : (
            <Package className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold">No orders found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasSearchOrFilters
              ? 'Try adjusting your search criteria or filters to find what you\'re looking for.'
              : 'No orders match the current filter. Orders will appear here once they are placed.'}
          </p>
        </div>

        {hasSearchOrFilters && onClearFilters && (
          <Button onClick={onClearFilters} variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>
    </Card>
  );
};

export const OrdersErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <Card className="p-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-destructive">Error loading orders</h3>
          <p className="text-sm text-muted-foreground mt-1">
            We couldn't load your orders. Please check your connection and try again.
          </p>
        </div>

        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            Try Again
          </Button>
        )}
      </div>
    </Card>
  );
};

export const OrdersLoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
        </Card>
      ))}
    </div>
  );
};
