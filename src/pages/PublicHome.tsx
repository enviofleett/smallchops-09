import { useState } from 'react';
import { Search, ShoppingCart, User, Star, Facebook, Instagram, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';

const PublicHome = () => {
  const { addItem } = useCart();
  const { toast } = useToast();

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

  const featuredProducts = [
    {
      id: 'grill-chill-box',
      name: 'The Grill & Chill Box',
      price: 10000,
      image: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&h=300&fit=crop',
      rating: 5
    },
    {
      id: 'odogwu-box',
      name: 'Odogwu Box',
      price: 10000,
      image: 'https://images.unsplash.com/photo-1501286353178-1ec881214838?w=400&h=300&fit=crop',
      rating: 5
    },
    {
      id: 'big-chop-energy',
      name: 'Big Chop Energy',
      price: 10000,
      image: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=300&fit=crop',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Circular Logo */}
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
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
                  className="pl-10 border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Cart and Profile */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-gray-700" />
                <span className="text-gray-700 font-medium">Cart</span>
              </div>
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-700" />
                <span className="text-gray-700 font-medium">Jideyemi</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white py-16 relative">
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

            {/* Right Side - Hero Image */}
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&h=400&fit=crop" 
                alt="Delicious Samosas and Small Chops" 
                className="w-full h-96 object-cover rounded-2xl"
              />
              
              {/* Floating Budget Baller Card */}
              <div className="absolute -bottom-8 -left-8 lg:-left-16">
                <Card className="w-72 bg-white shadow-2xl border-0">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="relative">
                        <img 
                          src="https://images.unsplash.com/photo-1501286353178-1ec881214838?w=300&h=200&fit=crop" 
                          alt="The Budget Baller" 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">The Budget Baller</h3>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <div>• 5 Samosa</div>
                          <div>• 5 Spring Rolls</div>
                          <div>• 5 Stick Meat</div>
                          <div>• 20 Poff-Poff</div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-xl font-bold text-red-600">₦9,450</div>
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
        </div>
      </section>

      {/* Products Section with Orange Background */}
      <section className="py-20" style={{ backgroundColor: '#FF6B35' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Featured Products</h2>
            <p className="text-white/90 text-lg">Our most popular small chop combinations</p>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredProducts.map((product) => (
              <Card key={product.id} className="bg-white hover:shadow-xl transition-all duration-300 border-0 rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative">
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-56 object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {product.name}
                    </h3>
                    <div className="flex items-center space-x-1 mb-4">
                      {renderStars(product.rating)}
                      <span className="text-sm text-gray-500 ml-2">
                        ({Math.floor(Math.random() * 50) + 80})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-red-600">
                        ₦{product.price.toLocaleString()}
                      </span>
                      <Button 
                        size="lg" 
                        className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 py-3 font-semibold"
                        onClick={() => handleAddToCart(product)}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">S</span>
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
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicHome;