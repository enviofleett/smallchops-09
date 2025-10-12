import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Home, Package, Users, Settings, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationPreview } from '@/components/notifications/NotificationPreview';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { useToast } from '@/hooks/use-toast';
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Enable inactivity timeout
  useInactivityTimeout();
  
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
        </div>

        {/* Right Side: Notifications */}
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          <NotificationBell />
        </div>
      </div>
      
      {/* Notification Preview - Global */}
      <NotificationPreview />
    </header>;
};
export default TopNav;