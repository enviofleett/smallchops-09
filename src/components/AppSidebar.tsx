import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Tag, 
  User, 
  Truck, 
  Trophy,
  Calendar,
  BarChart3, 
  FileSearch, 
  Settings,
  Mail
} from 'lucide-react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useRoleBasedPermissions } from '@/hooks/useRoleBasedPermissions';
import { MENU_PERMISSION_KEYS, type MenuPermissionKey } from '@/hooks/usePermissionGuard';
import startersLogo from '@/assets/starters-logo-christmas.png';
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
import { Skeleton } from "@/components/ui/skeleton";

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
  {
    icon: Trophy,
    label: 'Promotions & Loyalty',
    path: '/promotions',
    permissionKey: MENU_PERMISSION_KEYS.promotions
  }
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
    icon: Mail,
    label: 'Email Templates',
    path: '/admin/email-templates',
    permissionKey: MENU_PERMISSION_KEYS.settings
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
  const { userRole, hasPermission } = useRoleBasedPermissions();
  
  const collapsed = state === "collapsed";
  const isLoading = userRole === null;

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  // Pre-compute visible items to avoid flickering
  const visibleMenuGroups = useMemo(() => {
    if (isLoading) return { core: [], management: [], administration: [] };

    const filterItems = (items: MenuItem[]) => 
      items.filter(item => hasPermission(item.permissionKey, 'view'));

    return {
      core: filterItems(coreOperations),
      management: filterItems(management),
      administration: filterItems(administration),
    };
  }, [isLoading, hasPermission]);

  const renderMenuItem = (item: MenuItem) => (
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

  const renderMenuGroup = (items: MenuItem[], groupLabel: string) => {
    if (items.length === 0) return null;
    
    return (
      <SidebarGroup key={groupLabel}>
        <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider">
          {groupLabel}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const renderLoadingSkeleton = () => (
    <>
      {[1, 2, 3].map((group) => (
        <SidebarGroup key={group}>
          <SidebarGroupLabel>
            <Skeleton className="h-3 w-20" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[1, 2, 3].map((item) => (
                <SidebarMenuItem key={item}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4 shrink-0" />
                    {!collapsed && <Skeleton className="h-4 flex-1" />}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );

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
        {isLoading ? (
          renderLoadingSkeleton()
        ) : (
          <>
            {renderMenuGroup(visibleMenuGroups.core, "Core")}
            {renderMenuGroup(visibleMenuGroups.management, "Management")}
            {renderMenuGroup(visibleMenuGroups.administration, "Administration")}
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}