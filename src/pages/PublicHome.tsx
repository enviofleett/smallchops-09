import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Star, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { PriceDisplay } from '@/components/ui/price-display';
import { DiscountBadge } from '@/components/ui/discount-badge';

const PublicHome = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const { addItem } = useCart();
  const { toast } = useToast();

  // Fetch all products with discounts
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-with-discounts'],
    queryFn: () => getProductsWithDiscounts(),
  });

  // Filter products based on search
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
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
                  <Button className="bg-red-600 hover:bg-red-700 text-white px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-full shadow-lg w-full sm:w-auto">
                    Order Now & Enjoy!
                  </Button>
                </div>
              </div>
            </div>

            {/* Column 2 - Hero Image */}
            <div className="flex justify-center order-1 lg:order-2">
              <div className="w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96">
                <img 
                  src="/lovable-uploads/6ce07f82-8658-4534-a584-2c507d3ff58c.png" 
                  alt="Delicious snacks and treats" 
                  className="w-full h-full object-cover rounded-2xl"
                />
              </div>
            </div>
            
            {/* Column 3 - Budget Baller Card */}
            <div className="flex justify-center lg:justify-start order-3">
              <div className="w-full max-w-sm bg-white p-4 sm:p-6 rounded-2xl shadow-lg">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-gradient-to-r from-amber-200 to-orange-200 px-4 sm:px-8 py-2 sm:py-3 rounded-full flex items-center space-x-2 sm:space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                      </svg>
                    </div>
                    <h3 className="text-base sm:text-xl font-bold text-gray-900">The Budget Baller</h3>
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <span className="text-sm text-gray-600 text-center block pb-1 border-b border-dotted border-red-400">5 Samosa</span>
                  <span className="text-sm text-gray-600 text-center block pb-1 border-b border-dotted border-red-400">5 Spring Rolls</span>
                  <span className="text-sm text-gray-600 text-center block pb-1 border-b border-dotted border-red-400">5 Stick Meat</span>
                  <span className="text-sm text-gray-600 text-center block pb-1 border-b border-dotted border-red-400">20 Poff-Poff</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="bg-white py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-md mx-auto lg:max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search for your favorite snacks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
              />
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {/* Product Cards */}
            {isLoadingProducts ? (
              Array.from({ length: 8 }).map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="bg-gray-200 h-40 sm:h-48 rounded-lg mb-4"></div>
                    <div className="space-y-2">
                      <div className="bg-gray-200 h-4 rounded w-3/4"></div>
                      <div className="bg-gray-200 h-4 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredProducts.length > 0 ? (
              currentProducts.map((product) => (
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
                          handleAddToCart(product);
                        }}
                        className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                      >
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500 text-center col-span-full py-8">
                  No products found matching your search.
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 flex-wrap gap-2 mt-8">
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
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default PublicHome;