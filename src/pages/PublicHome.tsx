import React, { useState, memo, useMemo } from 'react';
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
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { PriceDisplay } from '@/components/ui/price-display';
import { DiscountBadge } from '@/components/ui/discount-badge';
import { HeroCarousel } from '@/components/branding/HeroCarousel';
import { BudgetBallerSection } from '@/components/branding/BudgetBallerSection';
import { SEOHead } from '@/components/SEOHead';
import { useImagePreloader } from '@/hooks/useImagePreloader';
import { PerformanceMonitor } from '@/utils/performance';
import { OptimizedImage } from '@/components/OptimizedImage';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import { ProgressiveLoader } from '@/components/ui/progressive-loader';
import { CheckoutButton } from '@/components/ui/checkout-button';
import ProductsFilters, { FilterState } from '@/components/products/ProductsFilters';

// Memoized components for better performance
const MemoizedProductCard = memo(({ product, onAddToCart, navigate }: any) => {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
      />
    ));
  };

  const moq = product.minimum_order_quantity || 1;

  return (
    <Card 
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
        {moq > 1 && (
          <div className="absolute top-1 sm:top-2 right-1 sm:right-2">
            <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full border border-blue-200">
              MOQ: {moq}
            </div>
          </div>
        )}
      </div>
      <CardContent className="p-2 sm:p-3 lg:p-4">
        <h3 className="font-semibold mb-1 sm:mb-2 line-clamp-2 text-sm sm:text-base">{product.name}</h3>
        <div className="flex items-center space-x-1 mb-1 sm:mb-2">
          {renderStars(4)}
          <span className="text-xs text-gray-500">(0)</span>
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
              onAddToCart(product);
            }}
            className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
          >
            Add {moq > 1 ? `${moq}+` : ''}
          </Button>
        </div>
        {moq > 1 && (
          <div className="text-xs text-muted-foreground mt-1 text-center">
            Min. order: {moq} units
          </div>
        )}
      </CardContent>
    </Card>
  );
});

MemoizedProductCard.displayName = 'MemoizedProductCard';

const PublicHome = () => {
  // Remove performance monitoring for production stability
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 50000],
    onlyPromotions: false,
    minRating: 0
  });
  const itemsPerPage = 9;

  const { addItem } = useCart();
  const { toast } = useToast();

  // Preload critical images (reduced for performance)
  useImagePreloader([
    '/lovable-uploads/6ce07f82-8658-4534-a584-2c507d3ff58c.png'
  ]);

  // Fetch products with discounts - Production Ready
  const { 
    data: products = [], 
    isLoading: isLoadingProducts, 
    error: productsError, 
    refetch: refetchProducts 
  } = useQuery({
    queryKey: ['products-with-discounts', activeCategory === 'all' ? undefined : activeCategory],
    queryFn: () => getProductsWithDiscounts(activeCategory === 'all' ? undefined : activeCategory),
    staleTime: 2 * 60 * 1000, // 2 minutes for better UX
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Debug logging for production troubleshooting
  console.log('🏠 PublicHome Debug:', {
    productsCount: products?.length || 0,
    isLoading: isLoadingProducts,
    hasError: !!productsError,
    activeCategory,
    searchTerm,
    productsPreview: products?.slice(0, 2)?.map(p => ({ id: p.id, name: p.name }))
  });

  // Fetch categories (PRODUCTION OPTIMIZED)
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (renamed from cacheTime)
  });

  // Calculate price range from products for filters
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

  // Smart Product Reshuffling Algorithm - Production Ready
  const createBalancedProductShuffle = useMemo(() => {
    return (productList: any[]) => {
      if (!Array.isArray(productList) || productList.length === 0) {
        return [];
      }

      // Sort products by price
      const sortedByPrice = [...productList].sort((a, b) => 
        (a.discounted_price || a.price) - (b.discounted_price || b.price)
      );

      // Divide into price tiers for equal distribution
      const tierSize = Math.ceil(sortedByPrice.length / 3);
      const lowPriceTier = sortedByPrice.slice(0, tierSize);
      const midPriceTier = sortedByPrice.slice(tierSize, tierSize * 2);
      const highPriceTier = sortedByPrice.slice(tierSize * 2);

      // Shuffle each tier individually
      const shuffleTier = (tier: any[]) => {
        const shuffled = [...tier];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };

      const shuffledLow = shuffleTier(lowPriceTier);
      const shuffledMid = shuffleTier(midPriceTier);
      const shuffledHigh = shuffleTier(highPriceTier);

      // Interleave products from different tiers for equal visibility
      const balanced = [];
      const maxLength = Math.max(shuffledLow.length, shuffledMid.length, shuffledHigh.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (shuffledLow[i]) balanced.push(shuffledLow[i]);
        if (shuffledMid[i]) balanced.push(shuffledMid[i]);
        if (shuffledHigh[i]) balanced.push(shuffledHigh[i]);
      }

      return balanced;
    };
  }, []);

  // Filter and shuffle products - Enhanced with advanced filtering
  const filteredAndShuffledProducts = useMemo(() => {
    if (!Array.isArray(products)) {
      console.warn('🚨 Products is not an array:', products);
      return [];
    }
    
    if (products.length === 0) {
      console.log('📦 No products available');
      return [];
    }

    // Apply all filters
    const filtered = products.filter(product => {
      if (!product?.name) {
        console.warn('🚨 Product missing name:', product);
        return false;
      }

      // Search filter
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Price filter
      const productPrice = product.discounted_price || product.price;
      const matchesPrice = productPrice >= filters.priceRange[0] && productPrice <= filters.priceRange[1];
      
      // Promotion filter
      const matchesPromotion = !filters.onlyPromotions || (product.discount_percentage && product.discount_percentage > 0);
      
      // Rating filter (placeholder for future rating implementation)
      const matchesRating = filters.minRating === 0;
      
      return matchesSearch && matchesPrice && matchesPromotion && matchesRating;
    });

    // Apply smart reshuffling for equal visibility
    const shuffled = createBalancedProductShuffle(filtered);
    
    console.log('🔍 Filtered and shuffled products:', {
      total: products.length,
      filtered: filtered.length,
      searchTerm,
      filtersActive: filters.onlyPromotions || 
        filters.priceRange[0] > priceRange[0] || 
        filters.priceRange[1] < priceRange[1] ||
        filters.minRating > 0
    });
    
    return shuffled;
  }, [products, searchTerm, filters, createBalancedProductShuffle, priceRange]);

  // Pagination with shuffled products
  const totalPages = Math.ceil(filteredAndShuffledProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredAndShuffledProducts.slice(startIndex, startIndex + itemsPerPage);

  const handleAddToCart = React.useCallback((product: any) => {
    try {
      const moq = product.minimum_order_quantity || 1;
      
      addItem({
        id: product.id,
        name: product.name,
        price: product.discounted_price || product.price,
        original_price: product.price,
        discount_amount: product.discount_amount,
        vat_rate: product.vat_rate || 7.5,
        image_url: product.image_url,
        minimum_order_quantity: moq
      }, moq); // Add MOQ quantity instead of 1
      
      toast({
        title: "Added to cart",
        description: `${moq > 1 ? `${moq} units of ` : ''}${product.name} ${moq > 1 ? '(minimum order)' : ''} added to your cart.`,
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: "Error",
        description: "Failed to add item to cart. Please try again.",
        variant: "destructive",
      });
    }
  }, [addItem, toast]);

  const renderStars = React.useCallback((rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
      />
    ));
  }, []);

  return (
    <>
      <SEOHead
        title="Starters - Premium Food Delivery"
        description="Order delicious food from Starters. Fresh ingredients, fast delivery, and amazing taste delivered to your door."
        keywords="food delivery, restaurant, online ordering, fast food, delivery service, starters"
        type="website"
      />
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Hero Section */}
      <section className="bg-white py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center">
            {/* Column 1 - Hero Content */}
            <div className="text-center lg:text-left order-2 lg:order-1">
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  Delicious Bites,<br />
                  Big Smiles
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-gray-600 px-4 sm:px-0">
                  Crispy, savory small chops, freshly made and delivered fast.
                </p>
                <div className="pt-2">
                  <Button 
                    onClick={() => navigate('/products')}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-full shadow-lg"
                  >
                    Order Now & Enjoy!
                  </Button>
                </div>
              </div>
            </div>

            {/* Column 2 - Hero Carousel */}
            <div className="flex justify-center order-1 lg:order-2">
              <HeroCarousel 
                className="w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96"
              />
            </div>
            
            {/* Column 3 - Budget Baller Card */}
            <div className="flex justify-center lg:justify-start order-3">
              <BudgetBallerSection className="w-full max-w-sm" />
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="bg-white py-8 sm:py-12 lg:py-16">
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
                      All
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => navigate(`/category/${category.id}`)}
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
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => navigate(`/category/${category.id}`)}
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
                  filteredProducts={filteredAndShuffledProducts.length}
                />
              </div>

              {/* Products Loading State */}
              {isLoadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                  {[...Array(9)].map((_, i) => (
                    <Card key={i} className="h-80 animate-pulse">
                      <CardContent className="p-0">
                        <div className="aspect-square bg-muted" />
                        <div className="p-4 space-y-2">
                          <div className="h-4 bg-muted rounded" />
                          <div className="h-3 bg-muted rounded w-2/3" />
                          <div className="h-6 bg-muted rounded w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : productsError ? (
                <div className="text-center py-8 sm:py-12">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2 text-red-600">Unable to load products</h3>
                  <p className="text-gray-600 mb-4 px-4">
                    There was an issue loading our products. Please try again.
                  </p>
                  <Button onClick={() => refetchProducts()} variant="outline">
                    Try Again
                  </Button>
                </div>
              ) : filteredAndShuffledProducts.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">No products found</h3>
                  <p className="text-gray-600 mb-4 px-4">
                    {searchTerm || filters.onlyPromotions || 
                     filters.priceRange[0] > priceRange[0] || 
                     filters.priceRange[1] < priceRange[1] ||
                     filters.minRating > 0
                      ? 'Try adjusting your search or filter settings.' 
                      : 'No products available yet.'}
                  </p>
                  {(searchTerm || filters.onlyPromotions || 
                    filters.priceRange[0] > priceRange[0] || 
                    filters.priceRange[1] < priceRange[1] ||
                    filters.minRating > 0) && (
                    <Button 
                      onClick={() => {
                        setSearchTerm('');
                        setFilters({
                          priceRange: priceRange,
                          onlyPromotions: false,
                          minRating: 0
                        });
                      }} 
                      variant="outline"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
              ) : (
                  <>
                    {/* Products Grid - Mobile optimized */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-8">
                      {currentProducts.map((product) => (
                        <MemoizedProductCard
                          key={product.id}
                          product={product}
                          onAddToCart={handleAddToCart}
                          navigate={navigate}
                        />
                      ))}
                    </div>

                    {/* Pagination - Mobile optimized */}
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center space-x-2 flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage <= 1}
                          className="text-xs sm:text-sm px-2 sm:px-3"
                        >
                          Prev
                        </Button>
                        
                        {/* Show fewer page numbers on mobile */}
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
      
      {/* Floating Checkout Button */}
      <CheckoutButton />
    </div>
    </>
  );
};

export default PublicHome;