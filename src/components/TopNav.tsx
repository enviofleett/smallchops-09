import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, LogOut, Home, Package, Users, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationPreview } from '@/components/notifications/NotificationPreview';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
const TopNav = () => {
  const {
    user,
    logout
  } = useAuth();
  const {
    data: settings
  } = useBusinessSettings();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };
  return <header className="bg-background border-b border-border sticky top-0 z-40 w-full">
      <div className="flex items-center justify-between gap-2 md:gap-4 px-3 py-3 md:px-6 md:py-4 min-h-[60px] md:min-h-[73px]">
        {/* Left Side: Mobile trigger + Navigation */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <SidebarTrigger className="shrink-0" />
          
          {/* Navigation Menu - Desktop Only */}
          {!isMobile && (
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-accent">
                    Dashboard
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid gap-3 p-6 w-80">
                      <div className="grid grid-cols-2 gap-3">
                        <NavigationMenuLink 
                          onClick={() => navigate('/')}
                          className="flex items-center gap-2 p-3 rounded-md hover:bg-accent cursor-pointer"
                        >
                          <Home className="h-4 w-4" />
                          <span>Overview</span>
                        </NavigationMenuLink>
                        <NavigationMenuLink 
                          onClick={() => navigate('/orders')}
                          className="flex items-center gap-2 p-3 rounded-md hover:bg-accent cursor-pointer"
                        >
                          <Package className="h-4 w-4" />
                          <span>Orders</span>
                        </NavigationMenuLink>
                        <NavigationMenuLink 
                          onClick={() => navigate('/customers')}
                          className="flex items-center gap-2 p-3 rounded-md hover:bg-accent cursor-pointer"
                        >
                          <Users className="h-4 w-4" />
                          <span>Customers</span>
                        </NavigationMenuLink>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent hover:bg-accent">
                    Products
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid gap-3 p-6 w-80">
                      <NavigationMenuLink 
                        onClick={() => navigate('/products')}
                        className="flex items-center gap-2 p-3 rounded-md hover:bg-accent cursor-pointer"
                      >
                        <Package className="h-4 w-4" />
                        <span>All Products</span>
                      </NavigationMenuLink>
                      <NavigationMenuLink 
                        onClick={() => navigate('/products/categories')}
                        className="flex items-center gap-2 p-3 rounded-md hover:bg-accent cursor-pointer"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Categories</span>
                      </NavigationMenuLink>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          )}
          
          {/* Search - Responsive */}
          <div className="flex-1 max-w-md min-w-0">
            <div className="relative">
              <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3 md:h-4 md:w-4" />
              <input 
                type="text" 
                placeholder={isMobile ? "Search..." : "Search orders, customers, products..."} 
                className="w-full pl-7 md:pl-10 pr-3 md:pr-4 py-1.5 md:py-2 bg-muted/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-xs md:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Notifications + User */}
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          {/* Notifications */}
          <NotificationBell />

          {/* User Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)} 
              className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="w-7 h-7 md:w-8 md:h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <User className="h-3 w-3 md:h-4 md:w-4 text-primary" />
              </div>
              {!isMobile && (
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground truncate max-w-[120px]">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-44 md:w-48 bg-popover rounded-lg shadow-lg border border-border py-2 z-50">
                <button 
                  onClick={() => {
                    navigate('/settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-popover-foreground hover:bg-accent flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </button>
                <hr className="my-2 border-border" />
                <button 
                  onClick={handleLogout} 
                  className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Notification Preview - Global */}
      <NotificationPreview />
    </header>;
};
export default TopNav;