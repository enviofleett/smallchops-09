import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Tag, 
  User, 
  Truck, 
  Trophy,
  BarChart3, 
  FileSearch, 
  Settings
} from 'lucide-react';
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
  useSidebar,
} from "@/components/ui/sidebar";

const coreOperations = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/'
  },
  {
    icon: ShoppingCart,
    label: 'Orders',
    path: '/orders'
  },
  {
    icon: Tag,
    label: 'Categories',
    path: '/categories'
  },
  {
    icon: Package,
    label: 'Products',
    path: '/products'
  }
];

const management = [
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
    icon: Trophy,
    label: 'Promotions & Loyalty',
    path: '/promotions'
  }
];

const administration = [
  {
    icon: BarChart3,
    label: 'Reports',
    path: '/reports'
  },
  {
    icon: FileSearch,
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
  
  const collapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const renderMenuGroup = (items: typeof coreOperations, groupLabel: string) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider">
        {groupLabel}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton 
                asChild 
                isActive={isActive(item.path)}
                tooltip={collapsed ? item.label : undefined}
                className="w-full justify-start"
              >
                <NavLink to={item.path} end={item.path === '/'}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 md:px-6 py-4 min-h-[73px] flex items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden bg-sidebar-accent">
            <img 
              src={startersLogo} 
              alt="Starters" 
              className="w-full h-full object-contain p-1.5" 
              loading="lazy" 
            />
          </div>
          {!collapsed && (
            <span className="text-2xl font-bold text-sidebar-foreground tracking-tight">
              Starters
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {renderMenuGroup(coreOperations, "Core")}
        {renderMenuGroup(management, "Management")}
        {renderMenuGroup(administration, "Administration")}
      </SidebarContent>
    </Sidebar>
  );
}