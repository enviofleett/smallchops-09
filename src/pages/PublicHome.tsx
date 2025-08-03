import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { getCategories } from '@/api/categories';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';

const PublicHome = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const { addItem } = useCart();
  const { toast } = useToast();

  // Fetch products with discounts
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-with-discounts', activeCategory === 'all' ? undefined : activeCategory],
    queryFn: () => getProductsWithDiscounts(activeCategory === 'all' ? undefined : activeCategory),
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
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
      price: product.price,
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
    <div className="min-h-screen">
      <PublicHeader />

      {/* Hero Section */}
      <section className="bg-white py-16 relative overflow-hidden">
        {/* Background accent lines */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute left-1/4 top-0 w-px h-full bg-green-400"></div>
          <div className="absolute left-2/4 top-0 w-px h-full bg-green-400"></div>
          <div className="absolute left-3/4 top-0 w-px h-full bg-green-400"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {/* Column 1 - Hero Content */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  Delicious Bites,<br />
                  Big Smiles
                </h1>
                <p className="text-lg lg:text-xl text-gray-600">
                  Crispy, savory small chops, freshly made and delivered fast.
                </p>
                <Button className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg rounded-full shadow-lg">
                  Order Now & Enjoy!
                </Button>
              </div>
            </div>

            {/* Column 2 - Hero Image */}
            <div className="flex justify-center">
              <div className="w-80 h-80 lg:w-96 lg:h-96">
                <img 
                  src="/lovable-uploads/8dfaab0f-8bc9-434a-ba8b-158885d43565.png" 
                  alt="Delicious meat pies" 
                  className="w-full h-full object-cover rounded-2xl"
                />
              </div>
            </div>
            
            {/* Column 3 - Budget Baller Card */}
            <div className="flex justify-center lg:justify-start">
              <div className="w-full max-w-sm bg-orange-50 p-6 rounded-2xl shadow-lg border border-orange-100">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">The Budget Baller</h3>
                </div>
                <div className="space-y-3 text-sm text-gray-800">
                  <div className="flex justify-between items-center pb-2 border-b border-dotted border-gray-300">
                    <span className="font-medium">5 Samosa</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-dotted border-gray-300">
                    <span className="font-medium">5 Spring Rolls</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-dotted border-gray-300">
                    <span className="font-medium">5 Stick Meat</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">20 Poff-Poff</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Showcase */}
      <section className="bg-gradient-to-r from-orange-300 to-red-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Samosa */}
            <Card className="bg-white rounded-lg shadow-lg overflow-hidden transform rotate-2 hover:rotate-0 transition-transform">
              <CardContent className="p-0">
                <div className="bg-gray-200 h-48 flex items-center justify-center">
                  <div className="w-16 h-16 bg-gray-400 rounded"></div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Samosa</h3>
                  <div className="flex items-center space-x-1 mb-4">
                    {renderStars(5)}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button 
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                      onClick={() => handleAddToCart({
                        id: 'samosa',
                        name: 'Samosa',
                        price: 5000
                      })}
                    >
                      Add to Cart
                    </Button>
                    <span className="text-xl font-bold text-gray-900">₦5,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wings & Things */}
            <Card className="bg-white rounded-lg shadow-lg overflow-hidden transform -rotate-2 hover:rotate-0 transition-transform">
              <CardContent className="p-0">
                <div className="bg-gray-200 h-48 flex items-center justify-center">
                  <div className="w-16 h-16 bg-gray-400 rounded"></div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Wings & Things</h3>
                  <div className="flex items-center space-x-1 mb-4">
                    {renderStars(5)}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button 
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                      onClick={() => handleAddToCart({
                        id: 'wings-things',
                        name: 'Wings & Things',
                        price: 15000
                      })}
                    >
                      Add to Cart
                    </Button>
                    <span className="text-xl font-bold text-gray-900">₦15,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar - Categories */}
            <div className="lg:col-span-1">
              <Card className="bg-white">
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

            {/* Right Side - Products Grid */}
            <div className="lg:col-span-3">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Products</h2>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {isLoadingProducts ? (
                  // Loading skeleton
                  Array.from({ length: 9 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-0">
                        <div className="aspect-square bg-gray-200 rounded-t-lg"></div>
                        <div className="p-4 space-y-2">
                          <div className="h-4 bg-gray-200 rounded"></div>
                          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  currentProducts.map((product, index) => (
                    <Card key={product.id || index} className="bg-white hover:shadow-lg transition-shadow">
                      <CardContent className="p-0">
                        <div className="relative">
                          <img 
                            src={product.image_url || "/public/hero-family.jpg"} 
                            alt={product.name || "The Budget Baller"}
                            className="w-full h-48 object-cover rounded-t-lg"
                          />
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-gray-900 mb-2 cursor-pointer hover:text-red-600 transition-colors" onClick={() => navigate(`/product/${product.id}`)}>
                            {product.name || "The Budget Baller"}
                          </h3>
                          <div className="flex items-center space-x-1 mb-2">
                            {renderStars(Math.floor(Math.random() * 2) + 4)}
                            <span className="text-sm text-gray-500">
                              ({Math.floor(Math.random() * 100) + 20})
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-bold text-red-600">
                              ₦{product.price?.toLocaleString() || "9,450"}
                            </span>
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                className="bg-red-600 hover:bg-red-700 text-white rounded-full px-3"
                                onClick={() => handleAddToCart(product)}
                              >
                                Add to Cart
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="rounded-full px-2"
                                onClick={() => navigate(`/product/${product.id}`)}
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Pagination */}
              <div className="flex justify-center items-center space-x-2">
                {Array.from({ length: totalPages || 4 }, (_, i) => (
                  <Button
                    key={i + 1}
                    variant={currentPage === i + 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-full ${
                      currentPage === i + 1 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-10 h-10 rounded-full border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages || 4))}
                  disabled={currentPage >= (totalPages || 4)}
                >
                  &gt;
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default PublicHome;