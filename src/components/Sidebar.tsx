
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
}

const Sidebar = ({ isCollapsed, onToggle }: SidebarProps) => {
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
    <div className={`bg-white shadow-lg transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    } min-h-screen relative`}>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 bg-white shadow-lg rounded-full p-1.5 border hover:shadow-xl transition-shadow"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-gray-600" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        )}
      </button>

      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center overflow-hidden">
            {settings?.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt={settings?.name || 'Business'} 
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-white font-bold text-sm">
                <Store className="h-4 w-4" />
              </span>
            )}
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-xl text-gray-800">{settings?.name || 'Business'}</span>
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
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-3 rounded-xl mb-2 transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`
                }
              >
                <item.icon className={`h-5 w-5 ${isCollapsed ? 'mx-auto' : ''}`} />
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </NavLink>
            );
          } else {
            return (
              <button
                key={item.label}
                onClick={item.action}
                className={`flex items-center space-x-3 px-3 py-3 rounded-xl mb-2 transition-all duration-200 group w-full text-left text-gray-600 hover:bg-gray-50 hover:text-gray-800`}
              >
                <item.icon className={`h-5 w-5 ${isCollapsed ? 'mx-auto' : ''}`} />
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
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
