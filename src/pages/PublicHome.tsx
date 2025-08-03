import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, Star, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { getCategories } from '@/api/categories';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { Skeleton } from '@/components/ui/skeleton';

const PublicHome = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const { addItem, cart } = useCart();
  const { toast } = useToast();
  const { isAuthenticated } = useAuthStatus();
  
  const categories = ['All', 'Platters', 'Packs', 'Lunchboxes', 'Customization'];

  // Fetch products with discounts
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-with-discounts', activeCategory === 'All' ? undefined : activeCategory],
    queryFn: () => getProductsWithDiscounts(activeCategory === 'All' ? undefined : activeCategory),
  });

  // Fetch database categories  
  const { data: dbCategories = [] } = useQuery({
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-gray-600 text-sm font-medium">STARTERS</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-red-600 font-medium">Home</a>
              <a href="#" className="text-gray-700 hover:text-red-600 transition-colors">Shop</a>
              <a href="#" className="text-gray-700 hover:text-red-600 transition-colors">Booking</a>
              <a href="#" className="text-gray-700 hover:text-red-600 transition-colors">Blog</a>
              <a href="#" className="text-gray-700 hover:text-red-600 transition-colors">About Us</a>
            </nav>

            {/* Search Bar */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Cart and User */}
            <div className="flex items-center space-x-6">
              <button 
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
                onClick={() => navigate('/customer-profile')}
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="font-medium">Cart</span>
                {cart.itemCount > 0 && (
                  <span className="bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cart.itemCount}
                  </span>
                )}
              </button>
              <div 
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => navigate(isAuthenticated ? '/customer-profile' : '/auth')}
              >
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-700 font-medium">
                  {isAuthenticated ? 'Profile' : 'Login'}
                </span>
              </div>
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
              <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                Delicious Bites,<br />
                Big Smiles
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Crispy, savory small chops, freshly made and delivered fast.
              </p>
              <button className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg rounded-full font-medium transition-colors">
                Order Now & Enjoy!
              </button>
            </div>

            {/* Right Side - Hero Image with Floating Card */}
            <div className="relative flex justify-center lg:justify-end">
              {/* Hero Food Image */}
              <div className="relative">
                <img 
                  src="/hero-family.jpg" 
                  alt="Delicious small chops" 
                  className="w-96 h-80 object-cover rounded-lg shadow-lg"
                />
                
                {/* Floating Budget Baller Card */}
                <div className="absolute -right-8 top-4 bg-orange-100 rounded-lg p-6 w-64 shadow-xl z-10">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <span className="font-semibold text-gray-900 text-lg">The Budget Baller</span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                      <span>5 Samosa</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                      <span>5 Spring Rolls</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                      <span>5 Stick Meat</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>20 Poff-Poff</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Showcase */}
      <section className="bg-gradient-to-r from-orange-300 via-orange-400 to-red-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* The Grill & Chill Box */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <div className="bg-gray-100 h-48 flex items-center justify-center">
                <img src="/hero-family.jpg" alt="The Grill & Chill Box" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">The Grill & Chill Box</h3>
                <div className="flex items-center space-x-1 mb-4">
                  {renderStars(5)}
                </div>
                <div className="flex items-center justify-between">
                  <button 
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                    onClick={() => handleAddToCart({
                      id: 'grill-chill-box',
                      name: 'The Grill & Chill Box',
                      price: 10000
                    })}
                  >
                    Add to Cart
                  </button>
                  <span className="text-xl font-bold text-gray-900">₦10,000</span>
                </div>
              </div>
            </div>

            {/* Odogwu Box */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <div className="bg-gray-100 h-48 flex items-center justify-center">
                <img src="/hero-family.jpg" alt="Odogwu Box" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Odogwu Box</h3>
                <div className="flex items-center space-x-1 mb-4">
                  {renderStars(5)}
                </div>
                <div className="flex items-center justify-between">
                  <button 
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                    onClick={() => handleAddToCart({
                      id: 'odogwu-box',
                      name: 'Odogwu Box',
                      price: 10000
                    })}
                  >
                    Add to Cart
                  </button>
                  <span className="text-xl font-bold text-gray-900">₦10,000</span>
                </div>
              </div>
            </div>

            {/* Big Chop Energy */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300">
              <div className="bg-gray-100 h-48 flex items-center justify-center">
                <img src="/hero-family.jpg" alt="Big Chop Energy" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Big Chop Energy</h3>
                <div className="flex items-center space-x-1 mb-4">
                  {renderStars(5)}
                </div>
                <div className="flex items-center justify-between">
                  <button 
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                    onClick={() => handleAddToCart({
                      id: 'big-chop-energy',
                      name: 'Big Chop Energy',
                      price: 10000
                    })}
                  >
                    Add to Cart
                  </button>
                  <span className="text-xl font-bold text-gray-900">₦10,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Section */}
      <section className="bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600">Explore trending products of the week.</p>
        </div>
      </section>

      {/* Products Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar - Categories */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-bold text-red-600 mb-4">Categories</h3>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        activeCategory === category 
                          ? 'bg-red-600 text-white' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side - Products Grid */}
            <div className="lg:col-span-3">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Products</h2>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {isLoadingProducts ? (
                  // Loading skeleton
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                      <div className="aspect-video bg-gray-200"></div>
                      <div className="p-4">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2 mb-3" />
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-6 w-1/4" />
                          <Skeleton className="h-8 w-1/3" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  currentProducts.map((product, index) => (
                    <div key={product.id || index} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow duration-300">
                      <div className="aspect-video bg-gray-100">
                        <img 
                          src={product.image_url || "/hero-family.jpg"} 
                          alt={product.name || "The Budget Baller"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 mb-2">
                          {product.name || "The Budget Baller"}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">Supernatural, Sci Fi, Thriller</p>
                        <div className="flex items-center space-x-1 mb-3">
                          {renderStars(5)}
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xl font-bold text-red-600">
                              ₦{product.price?.toLocaleString() || "9,450"}
                            </span>
                            {product.original_price && (
                              <span className="text-sm text-gray-500 line-through">
                                ₦{product.original_price.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button 
                          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
                          onClick={() => handleAddToCart(product)}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              <div className="flex justify-center items-center space-x-2">
                {[1, 2, 3, 4].map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      page === currentPage 
                        ? 'bg-red-600 text-white' 
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
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
              <h3 className="text-lg font-bold mb-4">Address</h3>
              <div className="space-y-2 text-gray-300">
                <div className="font-medium">Headquarters:</div>
                <div>No.31, Kubwa Road,</div>
                <div>3rd Avenue.</div>
                <div>Abuja.</div>
              </div>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-lg font-bold mb-4">Services</h3>
              <div className="space-y-2">
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Home</a>
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Shop</a>
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Blog</a>
              </div>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-lg font-bold mb-4">Company</h3>
              <div className="space-y-2">
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">About us</a>
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Blog</a>
                <a href="#" className="block text-gray-300 hover:text-white transition-colors">Dispatch Partner</a>
              </div>
            </div>

            {/* Contact Us */}
            <div>
              <h3 className="text-lg font-bold mb-4">Contact Us</h3>
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
                <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
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