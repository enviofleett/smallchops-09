import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShoppingCart, User, Star, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { getCategories } from '@/api/categories';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';

const PublicHome = () => {
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
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <img src="/lovable-uploads/38d91221-666e-459c-bef5-919b5455e55b.png" alt="Starters" className="h-10 w-auto" />
            </div>

            {/* Navigation Menu */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-red-600 font-medium">Home</a>
              <a href="#" className="text-gray-700 hover:text-red-600">Shop</a>
              <a href="#" className="text-gray-700 hover:text-red-600">Booking</a>
              <a href="#" className="text-gray-700 hover:text-red-600">Blog</a>
              <a href="#" className="text-gray-700 hover:text-red-600">About Us</a>
            </nav>

            {/* Search Bar */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search for products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-300"
                />
              </div>
            </div>

            {/* Cart and Profile */}
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="relative">
                <ShoppingCart className="w-5 h-5" />
                <Badge className="absolute -top-2 -right-2 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  0
                </Badge>
              </Button>
              <Button variant="ghost" size="sm">
                <User className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Hero Content */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                  Delicious Bites,<br />
                  Big Smiles
                </h1>
                <p className="text-xl text-gray-600">
                  Crispy, savory small chops, freshly made and delivered fast
                </p>
                <Button className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg rounded-full">
                  Order Now & Enjoy!
                </Button>
              </div>
            </div>

            {/* Right Side - Product Card */}
            <div className="flex justify-center">
              <Card className="w-80 bg-white border-2 border-gray-200 shadow-lg">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="relative">
                      <img 
                        src="/public/hero-family.jpg" 
                        alt="The Budget Baller" 
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Badge className="absolute top-2 right-2 bg-red-600 text-white">
                        Popular
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">The Budget Baller</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <div>• 5 Samosa</div>
                        <div>• 5 Spring Rolls</div>
                        <div>• 5 Stick Meat</div>
                        <div>• 20 Poff-Poff</div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-2xl font-bold text-red-600">₦9,450</div>
                        <div className="flex items-center space-x-1">
                          {renderStars(5)}
                          <span className="text-sm text-gray-500">(124)</span>
                        </div>
                      </div>
                      <Button 
                        className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white rounded-full"
                        onClick={() => handleAddToCart({
                          id: 'budget-baller',
                          name: 'The Budget Baller',
                          price: 9450
                        })}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Showcase */}
      <section className="bg-orange-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* The Grill & Chill Box */}
            <Card className="bg-white rounded-lg shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gray-200 h-48 flex items-center justify-center">
                  <div className="w-16 h-16 bg-gray-400 rounded"></div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">The Grill & Chill Box</h3>
                  <div className="flex items-center space-x-1 mb-4">
                    {renderStars(5)}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button 
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                      onClick={() => handleAddToCart({
                        id: 'grill-chill-box',
                        name: 'The Grill & Chill Box',
                        price: 10000
                      })}
                    >
                      Add to Cart
                    </Button>
                    <span className="text-xl font-bold text-gray-900">₦10,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Odogwu Box */}
            <Card className="bg-white rounded-lg shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gray-200 h-48 flex items-center justify-center">
                  <div className="w-16 h-16 bg-gray-400 rounded"></div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Odogwu Box</h3>
                  <div className="flex items-center space-x-1 mb-4">
                    {renderStars(5)}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button 
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                      onClick={() => handleAddToCart({
                        id: 'odogwu-box',
                        name: 'Odogwu Box',
                        price: 10000
                      })}
                    >
                      Add to Cart
                    </Button>
                    <span className="text-xl font-bold text-gray-900">₦10,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Big Chop Energy */}
            <Card className="bg-white rounded-lg shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gray-200 h-48 flex items-center justify-center">
                  <div className="w-16 h-16 bg-gray-400 rounded"></div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Big Chop Energy</h3>
                  <div className="flex items-center space-x-1 mb-4">
                    {renderStars(5)}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button 
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                      onClick={() => handleAddToCart({
                        id: 'big-chop-energy',
                        name: 'Big Chop Energy',
                        price: 10000
                      })}
                    >
                      Add to Cart
                    </Button>
                    <span className="text-xl font-bold text-gray-900">₦10,000</span>
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
                    <button
                      onClick={() => setActiveCategory('platters')}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        activeCategory === 'platters' 
                          ? 'bg-red-600 text-white' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      Platters
                    </button>
                    <button
                      onClick={() => setActiveCategory('packs')}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        activeCategory === 'packs' 
                          ? 'bg-red-600 text-white' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      Packs
                    </button>
                    <button
                      onClick={() => setActiveCategory('lunchboxes')}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        activeCategory === 'lunchboxes' 
                          ? 'bg-red-600 text-white' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      Lunchboxes
                    </button>
                    <button
                      onClick={() => setActiveCategory('customization')}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                        activeCategory === 'customization' 
                          ? 'bg-red-600 text-white' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      Customization
                    </button>
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
                          <h3 className="font-bold text-gray-900 mb-2">
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
                            <Button 
                              size="sm" 
                              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4"
                              onClick={() => handleAddToCart(product)}
                            >
                              Add to Cart
                            </Button>
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
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {/* Address */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-white">Address</h3>
              <div className="space-y-2 text-gray-300">
                <div className="font-medium">Headquarters:</div>
                <div>No.31, Kubwa Road,</div>
                <div>3rd Avenue.</div>
                <div>Abuja.</div>
              </div>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-white">Services</h3>
              <div className="space-y-2">
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Home</a>
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Shop</a>
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Blog</a>
              </div>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-white">Company</h3>
              <div className="space-y-2">
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">About us</a>
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Blog</a>
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Dispatch Partner</a>
              </div>
            </div>

            {/* Contact Us */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-white">Contact Us</h3>
              <div className="space-y-2 text-gray-300">
                <div>+234 807 3011 100</div>
                <div>+234 908 8388 886</div>
                <div>support@starters.co</div>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
              {/* Logo and Tagline */}
              <div className="flex items-center space-x-3">
                <img src="/lovable-uploads/38d91221-666e-459c-bef5-919b5455e55b.png" alt="Starters" className="h-8 w-auto" />
                <span className="text-gray-400 text-sm">SMALL CHOPS</span>
              </div>

              {/* Social Media Icons */}
              <div className="flex items-center space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicHome;