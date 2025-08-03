import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, Menu, X, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export const PublicHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { getItemCount } = useCart();
  const { data: settings } = useBusinessSettings();
  const { isAuthenticated, customerAccount, isLoading } = useCustomerAuth();
  const navigate = useNavigate();

  const handleCartClick = () => {
    navigate('/cart');
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/home" className="flex items-center space-x-2">
            <img
              src="/lovable-uploads/e95a4052-3128-4494-b416-9d153cf30c5c.png"
              alt="Starters Logo"
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link 
              to="/home" 
              className="text-foreground hover:text-primary transition-colors"
            >
              Home
            </Link>
            <Link 
              to="/products" 
              className="text-foreground hover:text-primary transition-colors"
            >
              Shop
            </Link>
            <Link 
              to="/booking" 
              className="text-foreground hover:text-primary transition-colors"
            >
              Booking
            </Link>
            <Link 
              to="/about" 
              className="text-foreground hover:text-primary transition-colors"
            >
              About
            </Link>
            <Link 
              to="/contact" 
              className="text-foreground hover:text-primary transition-colors"
            >
              Contact
            </Link>
          </nav>

          {/* Search Bar - Hidden on mobile, shown in mobile menu */}
          <div className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Right Actions - Mobile optimized */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Favorites - Hidden on small mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex"
              onClick={() => navigate('/customer-favorites')}
            >
              <Heart className="h-5 w-5" />
            </Button>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={handleCartClick}
            >
              <ShoppingCart className="h-5 w-5" />
              {getItemCount() > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {getItemCount()}
                </span>
              )}
            </Button>

            {/* User Account - Mobile optimized */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (isAuthenticated) {
                    navigate('/customer-profile');
                  } else {
                    navigate('/auth');
                  }
                }}
              >
                <User className="h-5 w-5" />
              </Button>
              {isAuthenticated && customerAccount && !isLoading && (
                <span className="hidden md:block text-sm font-medium text-foreground">
                  {customerAccount.name ? customerAccount.name.split(' ')[0] : 'Customer'}
                </span>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu - Improved */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-border py-4 bg-background">
            <div className="space-y-4">
              {/* Mobile Search */}
              <div className="relative px-4">
                <Search className="absolute left-7 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-3 bg-muted/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-base"
                />
              </div>

              {/* Mobile Navigation */}
              <nav className="flex flex-col space-y-1 px-4">
                <Link 
                  to="/home" 
                  className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Home
                </Link>
                <Link 
                  to="/products" 
                  className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Shop
                </Link>
                <Link 
                  to="/booking" 
                  className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Booking
                </Link>
                <Link 
                  to="/customer-favorites" 
                  className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Favorites
                </Link>
                <Link 
                  to="/about" 
                  className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </Link>
                <Link 
                  to="/contact" 
                  className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Contact
                </Link>
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};