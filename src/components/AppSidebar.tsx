import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Tag, 
  User, 
  Truck, 
  Calendar,
  BarChart3, 
  FileSearch, 
  Settings
} from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { usePermissionGuard, MENU_PERMISSION_KEYS, type MenuPermissionKey } from '@/hooks/usePermissionGuard';
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

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  permissionKey: MenuPermissionKey;
}

const coreOperations: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/dashboard',
    permissionKey: MENU_PERMISSION_KEYS.dashboard
  },
  {
    icon: ShoppingCart,
    label: 'Orders',
    path: '/admin/orders',
    permissionKey: MENU_PERMISSION_KEYS.orders
  },
  {
    icon: Tag,
    label: 'Categories',
    path: '/categories',
    permissionKey: MENU_PERMISSION_KEYS.categories
  },
  {
    icon: Package,
    label: 'Products',
    path: '/admin/products',
    permissionKey: MENU_PERMISSION_KEYS.products
  }
];

const management: MenuItem[] = [
  {
    icon: User,
    label: 'Customers',
    path: '/customers',
    permissionKey: MENU_PERMISSION_KEYS.customers
  },
  {
    icon: Calendar,
    label: 'Catering Bookings',
    path: '/bookings',
    permissionKey: MENU_PERMISSION_KEYS.bookings
  },
  {
    icon: Truck,
    label: 'Delivery Management',
    path: '/admin/delivery',
    permissionKey: MENU_PERMISSION_KEYS.delivery
  },
];

const administration: MenuItem[] = [
  {
    icon: BarChart3,
    label: 'Reports',
    path: '/reports',
    permissionKey: MENU_PERMISSION_KEYS.reports
  },
  {
    icon: FileSearch,
    label: 'Audit Logs',
    path: '/audit-logs',
    permissionKey: MENU_PERMISSION_KEYS.auditLogs
  },
  {
    icon: Settings,
    label: 'Settings',
    path: '/settings',
    permissionKey: MENU_PERMISSION_KEYS.settings
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { data: settings } = useBusinessSettings();
  
  const collapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const PermissionMenuItem = ({ item }: { item: MenuItem }) => {
    const { hasPermission, isLoading } = usePermissionGuard(item.permissionKey, 'view');
    
    // Don't render while loading permissions
    if (isLoading) return null;
    if (!hasPermission) return null;
    
    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton 
          asChild 
          isActive={isActive(item.path)}
          tooltip={collapsed ? item.label : undefined}
          className="w-full justify-start"
        >
          <NavLink to={item.path} end={item.path === '/dashboard'}>
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderMenuGroup = (items: MenuItem[], groupLabel: string) => {
    // Pre-filter items to avoid rendering empty groups
    const visibleItems = items.filter(item => {
      const { hasPermission, isLoading } = usePermissionGuard(item.permissionKey, 'view');
      return !isLoading && hasPermission;
    });
    
    if (visibleItems.length === 0) return null;
    
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider">
          {groupLabel}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <PermissionMenuItem key={item.path} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 md:px-6 py-4 min-h-[73px] flex items-center">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden bg-sidebar-accent">
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