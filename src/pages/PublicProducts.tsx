import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Star, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { getCategories } from '@/api/categories';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { PriceDisplay } from '@/components/ui/price-display';
import { DiscountBadge } from '@/components/ui/discount-badge';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { StarRating } from '@/components/ui/star-rating';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerFavorites, useFavoritesByProducts } from '@/hooks/useCustomerFavorites';
import { useProductRatingSummary } from '@/hooks/useProductReviews';

const PublicProducts = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const { addItem } = useCart();
  const { toast } = useToast();
  const { customerAccount } = useCustomerAuth();
  
  // Fetch products with discounts
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-with-discounts', activeCategory === 'all' ? undefined : activeCategory],
    queryFn: () => getProductsWithDiscounts(activeCategory === 'all' ? undefined : activeCategory),
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

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  // Filter products based on search
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative max-w-md mx-auto lg:mx-0">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 py-3 text-base"
                  />
                </div>
              </div>

              {/* Results Count */}
              <div className="mb-4">
                <p className="text-gray-600">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                  {activeCategory !== 'all' && categories.find(c => c.id === activeCategory) && 
                    ` in ${categories.find(c => c.id === activeCategory)?.name}`
                  }
                </p>
              </div>

              {/* Loading State */}
              {isLoadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-0">
                        <div className="aspect-square bg-gray-200 rounded-t-lg"></div>
                        <div className="p-3 sm:p-4 space-y-2">
                          <div className="h-4 bg-gray-200 rounded"></div>
                          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                        <div className="aspect-[4/3] sm:aspect-square overflow-hidden relative">
                          <img
                            src={product.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=300&h=300&fit=crop'}
                            alt={product.name}
                            className="w-full h-full object-cover object-center hover:scale-105 transition-transform"
                            loading="lazy"
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