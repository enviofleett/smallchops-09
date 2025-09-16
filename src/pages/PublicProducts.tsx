import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Star, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toImagesArray } from '@/lib/imageUtils';
import { Input } from '@/components/ui/input';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { getCategories } from '@/api/categories';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { PriceDisplay } from '@/components/ui/price-display';
import { DiscountBadge } from '@/components/ui/discount-badge';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { StarRating } from '@/components/ui/star-rating';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerFavorites, useFavoritesByProducts } from '@/hooks/useCustomerFavorites';
import { useProductRatingSummary } from '@/hooks/useProductReviews';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import ProductsFilters, { FilterState } from '@/components/products/ProductsFilters';

const PublicProducts = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 50000],
    onlyPromotions: false,
    minRating: 0
  });
  const itemsPerPage = 12;

  const { addItem } = useCart();
  const { toast } = useToast();
  const { customerAccount } = useCustomerAuth();
  
  // Fetch products with discounts - Production Ready
  const { 
    data: products = [], 
    isLoading: isLoadingProducts, 
    error: productsError,
    refetch: refetchProducts 
  } = useQuery({
    queryKey: ['products-with-discounts', activeCategory === 'all' ? undefined : activeCategory],
    queryFn: () => getProductsWithDiscounts(activeCategory === 'all' ? undefined : activeCategory),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  const { 
    favorites, 
    addToFavorites, 
    removeFromFavorites 
  } = useCustomerFavorites(customerAccount?.id || '');
  
  // Get favorites status for current products
  const { data: favoritesByProducts = {} } = useFavoritesByProducts(
    customerAccount?.id, 
    products?.map(p => p.id) || []
  );

  // Fetch categories - optimized
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    retry: 1,
    staleTime: 300000, // 5 minutes cache for categories
    refetchOnWindowFocus: false,
  });

  // Calculate price range from products
  const priceRange: [number, number] = useMemo(() => {
    if (!products.length) return [0, 50000];
    const prices = products.map(p => p.discounted_price || p.price);
    return [Math.floor(Math.min(...prices) / 1000) * 1000, Math.ceil(Math.max(...prices) / 1000) * 1000];
  }, [products]);

  // Update filters when products change
  useMemo(() => {
    if (products.length && filters.priceRange[0] === 0 && filters.priceRange[1] === 50000) {
      setFilters(prev => ({ ...prev, priceRange: priceRange }));
    }
  }, [products.length, priceRange, filters.priceRange]);

  // Filter products based on all criteria
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Search filter
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Price filter
      const productPrice = product.discounted_price || product.price;
      const matchesPrice = productPrice >= filters.priceRange[0] && productPrice <= filters.priceRange[1];
      
      // Promotion filter
      const matchesPromotion = !filters.onlyPromotions || (product.discount_percentage && product.discount_percentage > 0);
      
      // Rating filter (you'll need to implement this based on your rating system)
      const matchesRating = filters.minRating === 0; // For now, assuming all products match
      
      return matchesSearch && matchesPrice && matchesPromotion && matchesRating;
    });
  }, [products, searchTerm, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const handleAddToCart = (product: any) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.discounted_price || product.price,
      original_price: product.price,
      discount_amount: product.discount_amount,
      vat_rate: product.vat_rate || 7.5,
      image_url: product.image_url,
    });
    
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleToggleFavorite = async (productId: string) => {
    console.log('🔍 Toggle favorite clicked:', { productId, customerAccount: customerAccount?.id });
    
    if (!customerAccount?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save favorites.",
        variant: "destructive",
      });
      return;
    }

    try {
      const isFavorite = favoritesByProducts[productId] || false;
      if (isFavorite) {
        await removeFromFavorites({ customerId: customerAccount.id, productId });
        toast({
          title: "Removed from favorites",
          description: "Product removed from your wishlist.",
        });
      } else {
        await addToFavorites({ customerId: customerAccount.id, productId });
        toast({
          title: "Added to favorites",
          description: "Product added to your wishlist.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorites. Please try again.",
        variant: "destructive",
      });
    }
  };

  const ProductRatingDisplay = ({ productId }: { productId: string }) => {
    const { data: ratingSummary } = useProductRatingSummary(productId);
    
    if (!ratingSummary || ratingSummary.total_reviews === 0) {
      return (
        <div className="flex items-center space-x-1">
          <StarRating rating={0} size="sm" />
          <span className="text-xs text-gray-500">(0)</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center space-x-1">
        <StarRating rating={ratingSummary.average_rating} size="sm" />
        <span className="text-xs text-gray-500">({ratingSummary.total_reviews})</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Page Header */}
      <section className="bg-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Our Products
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover our delicious range of freshly made small chops and treats, perfect for any occasion.
            </p>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="bg-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Left Sidebar - Categories - Hidden on mobile */}
            <div className="hidden lg:block lg:col-span-1">
              <Card className="bg-white sticky top-4">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-red-600 mb-4">Categories</h3>
                   <div className="space-y-2">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        activeCategory === 'all' 
                          ? 'bg-red-600 text-white' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      All Products
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                          activeCategory === category.id 
                            ? 'bg-red-600 text-white' 
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mobile Categories - Horizontal scroll */}
            <div className="lg:hidden col-span-full mb-6">
              <h3 className="text-lg font-bold text-red-600 mb-3 px-2">Categories</h3>
              <div className="flex space-x-3 overflow-x-auto pb-3 px-2">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === 'all' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-white text-gray-700 border border-gray-200'
                  }`}
                >
                  All Products
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      activeCategory === category.id 
                        ? 'bg-red-600 text-white' 
                        : 'bg-white text-gray-700 border border-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Side - Products */}
            <div className="col-span-full lg:col-span-3">
              {/* Advanced Filters */}
              <div className="mb-6">
                <ProductsFilters
                  categoryFilter={activeCategory}
                  onCategoryChange={setActiveCategory}
                  searchQuery={searchTerm}
                  onSearchChange={setSearchTerm}
                  categories={categories}
                  isLoadingCategories={false}
                  filters={filters}
                  onFiltersChange={setFilters}
                  priceRange={priceRange}
                  totalProducts={products.length}
                  filteredProducts={filteredProducts.length}
                />
              </div>

              {/* Loading State & Error Handling */}
              {isLoadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                  <SkeletonLoader variant="product" count={8} />
                </div>
              ) : productsError ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-semibold mb-2 text-red-600">Unable to load products</h3>
                  <p className="text-gray-600 mb-4">
                    There was an issue loading our products. Please try again.
                  </p>
                  <Button 
                    onClick={() => refetchProducts()}
                    variant="outline"
                  >
                    Retry
                  </Button>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-semibold mb-2">No products found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm 
                      ? 'Try adjusting your search terms or browse all categories.' 
                      : 'No products available in this category.'}
                  </p>
                  {searchTerm && (
                    <Button 
                      onClick={() => setSearchTerm('')}
                      variant="outline"
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Products Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-8">
                    {currentProducts.map((product) => (
                      <Card 
                        key={product.id} 
                        className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => navigate(`/product/${product.id}`)}
                      >
                        <div className="relative">
                          <ProductImageGallery
                            images={toImagesArray(product)}
                            alt={product.name}
                            containerClassName="aspect-[4/3] sm:aspect-square"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                          {(product.discount_percentage || 0) > 0 && (
                            <div className="absolute top-1 sm:top-2 left-1 sm:left-2">
                              <DiscountBadge 
                                discountPercentage={product.discount_percentage || 0}
                                size="sm"
                              />
                            </div>
                          )}
                        </div>
                        <CardContent className="p-2 sm:p-3 lg:p-4">
                          <div className="flex items-start justify-between mb-1 sm:mb-2">
                            <h3 className="font-semibold line-clamp-2 text-sm sm:text-base flex-1">{product.name}</h3>
                            <FavoriteButton
                              isFavorite={favoritesByProducts[product.id] || false}
                              onToggle={() => handleToggleFavorite(product.id)}
                              size="sm"
                              className="ml-2"
                            />
                          </div>
                          <div className="mb-1 sm:mb-2">
                            <ProductRatingDisplay productId={product.id} />
                          </div>
                          <div className="flex items-center justify-between">
                            <PriceDisplay
                              originalPrice={product.price}
                              discountedPrice={product.discounted_price}
                              hasDiscount={(product.discount_percentage || 0) > 0}
                              size="sm"
                            />
                            <Button 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(product);
                              }}
                              className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                            >
                              Add
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-2 flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="text-xs sm:text-sm px-2 sm:px-3"
                      >
                        Previous
                      </Button>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        if (pageNum <= totalPages) {
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm"
                            >
                              {pageNum}
                            </Button>
                          );
                        }
                        return null;
                      })}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                        className="text-xs sm:text-sm px-2 sm:px-3"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default PublicProducts;