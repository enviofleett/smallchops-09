
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import { useOptimizedProducts } from '@/hooks/useOptimizedProducts';
import { useNetworkResilience } from '@/hooks/useNetworkResilience';
import { useDebounce } from '@/hooks/useDebounce';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

interface OptimizedProductGridProps {
  categoryId?: string;
  showFilters?: boolean;
}

const OptimizedProductGrid: React.FC<OptimizedProductGridProps> = ({
  categoryId = 'all',
  showFilters = true,
}) => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categoryId);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(searchTerm, 500);

  const optimizedQuery = useOptimizedProducts({
    categoryId: selectedCategory,
    page,
    limit: itemsPerPage,
    search: debouncedSearch || undefined,
  });

  const productsQuery = useNetworkResilience(
    optimizedQuery,
    {
      fallbackData: {
        products: [],
        pagination: {
          page: 1,
          limit: itemsPerPage,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
        timestamp: new Date().toISOString(),
      },
      showToast: true,
    }
  );

  const { data, isLoading, isError } = productsQuery;
  const { products, pagination } = data || { products: [], pagination: null };

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [selectedCategory, debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const memoizedProducts = useMemo(() => products, [products]);

  if (isLoading && !memoizedProducts.length) {
    return (
      <div className="space-y-6">
        {showFilters && (
          <div className="flex gap-4 p-4 bg-card rounded-lg">
            <div className="h-10 bg-muted animate-pulse rounded w-64" />
            <div className="h-10 bg-muted animate-pulse rounded w-32" />
            <div className="h-10 bg-muted animate-pulse rounded w-24" />
          </div>
        )}
        <SkeletonLoader variant="product" count={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {/* Categories will be populated from actual data */}
                </SelectContent>
              </Select>

              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 items</SelectItem>
                  <SelectItem value="40">40 items</SelectItem>
                  <SelectItem value="50">50 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {memoizedProducts.map((product) => (
          <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-square bg-muted">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold line-clamp-2 mb-2">{product.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {product.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">₦{product.price}</span>
                <Button size="sm">Add to Cart</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {!isLoading && memoizedProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No products found.</p>
          {(debouncedSearch || selectedCategory !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
              className="mt-4"
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} products
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={!pagination.hasPrevPage || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={!pagination.hasNextPage || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Loading Overlay for Pagination */}
      {isLoading && memoizedProducts.length > 0 && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
};

export default OptimizedProductGrid;
