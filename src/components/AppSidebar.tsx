import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  User, 
  Package, 
  Tag, 
  Truck, 
  Settings, 
  ChevronDown
} from 'lucide-react';
import { PromotionsSidebarIcon } from "./PromotionsSidebarIcon";
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import startersLogo from '@/assets/starters-logo.png';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CategoriesManager from '@/components/categories/CategoriesManager';

const menuItems = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/'
  },
  {
    icon: FileText,
    label: 'Orders',
    path: '/orders'
  },
  {
    icon: Package,
    label: 'Products',
    path: '/products'
  },
  {
    icon: User,
    label: 'Customers',
    path: '/customers'
  },
  {
    icon: Truck,
    label: 'Delivery & Pickup',
    path: '/delivery-pickup'
  },
  {
    icon: PromotionsSidebarIcon,
    label: 'Promotions & Loyalty',
    path: '/promotions'
  },
  {
    icon: FileText,
    label: 'Reports',
    path: '/reports'
  },
  {
    icon: FileText,
    label: 'Audit Logs',
    path: '/audit-logs'
  },
  {
    icon: Settings,
    label: 'Settings',
    path: '/settings'
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { data: settings } = useBusinessSettings();
  const [isCategoriesOpen, setCategoriesOpen] = React.useState(false);
  
  const collapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-sidebar-accent">
              <img 
                src={startersLogo} 
                alt="Starters" 
                className="w-full h-full object-contain p-0.5" 
                loading="lazy" 
              />
            </div>
            {!collapsed && (
              <span className="text-lg font-bold text-sidebar-foreground">
                Starters
              </span>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive(item.path)}
                      tooltip={collapsed ? item.label : undefined}
                    >
                      <NavLink to={item.path} end={item.path === '/'}>
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {/* Categories Special Item */}
                <SidebarMenuItem>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton 
                        onClick={() => setCategoriesOpen(true)}
                        tooltip={collapsed ? "Categories" : undefined}
                      >
                        <Tag className="w-4 h-4" />
                        {!collapsed && (
                          <>
                            <span>Categories</span>
                            <ChevronDown className="ml-auto w-4 h-4" />
                          </>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </Collapsible>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

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
    </>
  );
}