
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  User, 
  ChevronLeft,
  ChevronRight,
  Package,
  Tag,
  Truck,
  Settings,
  Store
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import CategoriesManager from '@/components/categories/CategoriesManager';
import { PromotionsSidebarIcon } from "./PromotionsSidebarIcon";
import { useBusinessSettings } from '@/hooks/useBusinessSettings';


interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  mobileSidebarOpen?: boolean;
  setMobileSidebarOpen?: (open: boolean) => void;
}

const Sidebar = ({ 
  isCollapsed, 
  onToggle, 
  isMobile = false, 
  mobileSidebarOpen = false, 
  setMobileSidebarOpen 
}: SidebarProps) => {
  const [isCategoriesOpen, setCategoriesOpen] = useState(false);
  const { data: settings } = useBusinessSettings();
  

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'Orders', path: '/orders' },
    { icon: Tag, label: 'Categories', path: null, action: () => setCategoriesOpen(true) },
    { icon: Package, label: 'Products', path: '/products' },
    { icon: User, label: 'Customers', path: '/customers' },
    { icon: Truck, label: 'Delivery & Pickup', path: '/delivery-pickup' },
    { icon: PromotionsSidebarIcon, label: 'Promotions & Loyalty', path: '/promotions' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: FileText, label: 'Audit Logs', path: '/audit-logs' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className={`bg-card shadow-lg transition-all duration-300 ${
      isMobile 
        ? `fixed inset-y-0 left-0 z-50 w-64 transform ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:w-16 lg:hover:w-64`
        : isCollapsed ? 'w-16 hover:w-64' : 'w-64'
    } min-h-screen relative group`}>
      {/* Toggle Button - Hidden on mobile */}
      {!isMobile && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-6 bg-card shadow-lg rounded-full p-1.5 border hover:shadow-xl transition-shadow"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}

      {/* Mobile close button */}
      {isMobile && mobileSidebarOpen && (
        <button
          onClick={() => setMobileSidebarOpen?.(false)}
          className="absolute top-6 right-4 p-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center overflow-hidden">
            {settings?.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt={settings?.name || 'Business'} 
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-primary-foreground font-bold text-sm">
                <Store className="h-4 w-4" />
              </span>
            )}
          </div>
          {(isMobile || !isCollapsed || (!isMobile && !isCollapsed)) && (
            <span className={`font-semibold text-xl text-foreground transition-opacity ${
              !isMobile && isCollapsed ? 'lg:opacity-0 lg:group-hover:opacity-100' : ''
            }`}>
              {settings?.name || 'Business'}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-4">
        {menuItems.map((item) => {
          if (item.path) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => isMobile && setMobileSidebarOpen?.(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-3 rounded-xl mb-2 transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`
                }
              >
                <item.icon className={`h-5 w-5 flex-shrink-0 ${!isMobile && isCollapsed ? 'mx-auto' : ''}`} />
                {(isMobile || !isCollapsed) && (
                  <span className={`font-medium transition-opacity ${
                    !isMobile && isCollapsed ? 'lg:opacity-0 lg:group-hover:opacity-100' : ''
                  }`}>
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          } else {
            return (
              <button
                key={item.label}
                onClick={() => {
                  item.action?.();
                  isMobile && setMobileSidebarOpen?.(false);
                }}
                className={`flex items-center space-x-3 px-3 py-3 rounded-xl mb-2 transition-all duration-200 group w-full text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
              >
                <item.icon className={`h-5 w-5 flex-shrink-0 ${!isMobile && isCollapsed ? 'mx-auto' : ''}`} />
                {(isMobile || !isCollapsed) && (
                  <span className={`font-medium transition-opacity ${
                    !isMobile && isCollapsed ? 'lg:opacity-0 lg:group-hover:opacity-100' : ''
                  }`}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          }
        })}
      </nav>

      <Dialog open={isCategoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Here you can view, add, edit, and delete product categories.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-auto">
            <CategoriesManager />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sidebar;
