import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, Menu, X, Heart, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
import { useFavorites } from '@/hooks/useFavorites';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useWebsiteMenu } from '@/hooks/useWebsiteMenu';
import { useHeaderBanners } from '@/hooks/useHeaderBanners';
import ProductionErrorBoundary from '@/components/ProductionErrorBoundary';
import { AuthButton } from '@/components/auth/AuthButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationPreview } from '@/components/notifications/NotificationPreview';
import { NotificationIntegration } from '@/components/notifications/NotificationIntegration';
import { HeaderBanner } from '@/components/banners/HeaderBanner';
import startersLogo from '@/assets/starters-logo.png';
export const PublicHeader = () => {
  return <ProductionErrorBoundary context="PublicHeader" showErrorDetails={false}>
      <PublicHeaderContent />
    </ProductionErrorBoundary>;
};
const PublicHeaderContent = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Keep for backward compatibility
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());
  const {
    getItemCount
  } = useCart();
  const {
    getFavoritesCount
  } = useFavorites();
  const {
    data: settings,
    error
  } = useBusinessSettings();
  const {
    isAuthenticated,
    customerAccount,
    isLoading
  } = useCustomerAuth();
  const {
    data: menuItems
  } = useWebsiteMenu();
  const {
    data: banners
  } = useHeaderBanners();
  const navigate = useNavigate();
  const handleCartClick = () => {
    navigate('/cart');
  };
  const handleDismissBanner = (bannerId: string) => {
    setDismissedBanners(prev => new Set([...prev, bannerId]));
  };

  // Graceful degradation for logo and business name
  const logoUrl = settings?.logo_url || startersLogo;
  const businessName = settings?.name || "Starters";

  // Filter out dismissed banners
  const activeBanners = banners?.filter(banner => !dismissedBanners.has(banner.id)) || [];
  return <div>
      {/* Header Banners */}
      {activeBanners.map(banner => <HeaderBanner key={banner.id} banner={banner} onDismiss={() => handleDismissBanner(banner.id)} dismissible={true} />)}
      
      {/* Main Header */}
      <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img src={logoUrl} alt={`${businessName} Logo`} className="h-12 w-auto" onError={e => {
              e.currentTarget.src = startersLogo;
            }} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {menuItems?.map(item => <Link key={item.id} to={item.url || '#'} className="text-foreground hover:text-primary transition-colors" target={item.target}>
                {item.label}
              </Link>)}
            {/* Special Deals Link */}
            
          </nav>


          {/* Right Actions - Mobile optimized */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Favorites - Hidden on small mobile */}
            <Button variant="ghost" size="icon" className="hidden sm:flex relative" onClick={() => {
              if (isAuthenticated) {
                navigate('/favorites');
              } else {
                navigate('/auth?redirect=/favorites');
              }
            }}>
              <Heart className="h-5 w-5" />
              {getFavoritesCount() > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {getFavoritesCount()}
                </span>}
            </Button>

            {/* Notifications */}
            <NotificationBell />

            {/* Cart */}
            <Button variant="ghost" size="icon" className="relative" onClick={handleCartClick}>
              <ShoppingCart className="h-5 w-5" />
              {getItemCount() > 0 && <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {getItemCount()}
                </span>}
            </Button>

            {/* User Authentication */}
            <AuthButton variant="ghost" size="icon" showText={false} />

            {/* Mobile Menu Toggle */}
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu - Improved */}
        {isMobileMenuOpen && <div className="lg:hidden border-t border-border py-4 bg-background">
            <div className="space-y-4">

              {/* Mobile Navigation */}
              <nav className="flex flex-col space-y-1 px-4">
                {menuItems?.map(item => <Link key={item.id} to={item.url || '#'} className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium" target={item.target} onClick={() => setIsMobileMenuOpen(false)}>
                    {item.label}
                  </Link>)}
                {/* Special Deals Link - Mobile */}
                <Link to="/categories/deals" className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-md font-medium transition-colors text-base" onClick={() => setIsMobileMenuOpen(false)}>
                  Deals
                </Link>
                {isAuthenticated && <button className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium text-left w-full" onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/track-order');
              }}>
                    Track Order
                  </button>}
                <button className="text-foreground hover:text-primary transition-colors py-3 text-base font-medium text-left w-full flex items-center justify-between" onClick={() => {
                setIsMobileMenuOpen(false);
                if (isAuthenticated) {
                  navigate('/favorites');
                } else {
                  navigate('/auth?redirect=/favorites');
                }
              }}>
                  <span>Favorites</span>
                  {getFavoritesCount() > 0 && <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {getFavoritesCount()}
                    </span>}
                </button>
              </nav>
            </div>
          </div>}
      </div>
      
      {/* Notification Preview - Global */}
      <NotificationPreview />
      
      {/* Notification Integration - Global Event Listeners */}
      <NotificationIntegration />
      </header>
    </div>;
};