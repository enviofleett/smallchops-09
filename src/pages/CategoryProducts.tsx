import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { getCategories } from '@/api/categories';
import { PriceDisplay } from '@/components/ui/price-display';
import { DiscountBadge } from '@/components/ui/discount-badge';

const CategoryProducts = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Fetch products for this category
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-with-discounts', categoryId],
    queryFn: () => getProductsWithDiscounts(categoryId),
    enabled: !!categoryId,
  });

  // Fetch categories to get category name
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const currentCategory = categories.find(cat => cat.id === categoryId);

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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
      />
    ));
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{currentCategory?.name || 'Category'}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Left Sidebar - Categories - Hidden on mobile */}
          <div className="hidden lg:block lg:col-span-1">
            <Card className="bg-white sticky top-4">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-red-600 mb-4">Categories</h3>
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="w-full justify-start px-4 py-2 hover:bg-gray-100 text-gray-700"
                  >
                    All Products
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant="ghost"
                      onClick={() => navigate(`/category/${category.id}`)}
                      className={`w-full justify-start px-4 py-2 transition-colors ${
                        categoryId === category.id 
                          ? 'bg-red-600 text-white hover:bg-red-700' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {category.name}
                    </Button>
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
                onClick={() => navigate('/')}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-200"
              >
                All Products
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => navigate(`/category/${category.id}`)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    categoryId === category.id 
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
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold mb-4">{currentCategory?.name || 'Products'}</h1>
              {currentCategory?.description && (
                <p className="text-muted-foreground mb-4 sm:mb-6">{currentCategory.description}</p>
              )}
              
              {/* Search */}
              <div className="max-w-md mx-auto lg:mx-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 py-3 text-base"
                  />
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {isLoadingProducts ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-0">
                      <div className="aspect-square bg-muted rounded-t-lg"></div>
                      <div className="p-3 sm:p-4 space-y-2">
                        <div className="h-4 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                        <div className="h-6 bg-muted rounded w-1/2"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground mb-4 px-4">
                  {searchTerm ? 'Try adjusting your search terms.' : 'This category has no products yet.'}
                </p>
                <Button onClick={() => navigate('/')}>
                  Browse All Products
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-8">
                  {currentProducts.map((product) => (
                    <Card 
                      key={product.id} 
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <div className="aspect-square overflow-hidden relative">
                        <img
                          src={product.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=300&h=300&fit=crop'}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
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
                        <h3 className="font-semibold mb-1 sm:mb-2 line-clamp-2 text-sm sm:text-base">{product.name}</h3>
                        <div className="flex items-center space-x-1 mb-1 sm:mb-2">
                          {renderStars(4)} {/* Using static rating for now */}
                          <span className="text-xs text-muted-foreground">(0)</span>
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
                  <div className="flex justify-center items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </Button>
                    
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Button
                        key={i + 1}
                        variant={currentPage === i + 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(i + 1)}
                        className="w-10 h-10"
                      >
                        {i + 1}
                      </Button>
                    ))}
                    
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
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

      <PublicFooter />
    </div>
  );
};

export default CategoryProducts;