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
  Calendar,
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

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  end?: boolean;
}

const coreOperations: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/dashboard',
    end: true
  },
  {
    icon: ShoppingCart,
    label: 'Orders',
    path: '/admin/orders'
  },
  {
    icon: Tag,
    label: 'Categories',
    path: '/categories'
  },
  {
    icon: Package,
    label: 'Products',
    path: '/admin/products'
  }
];

const management: MenuItem[] = [
  {
    icon: User,
    label: 'Customers',
    path: '/customers'
  },
  {
    icon: Calendar,
    label: 'Catering Bookings',
    path: '/bookings'
  },
  {
    icon: Truck,
    label: 'Delivery Management',
    path: '/admin/delivery'
  },
  {
    icon: Trophy,
    label: 'Promotions & Loyalty',
    path: '/promotions'
  }
];

const administration: MenuItem[] = [
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

  const isActive = React.useCallback((path: string, end?: boolean) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/admin';
    }
    return end 
      ? location.pathname === path
      : location.pathname.startsWith(path);
  }, [location.pathname]);

  const renderMenuGroup = React.useCallback((items: MenuItem[], groupLabel: string) => (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider">
          {groupLabel}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton 
                asChild 
                isActive={isActive(item.path, item.end)}
                tooltip={collapsed ? item.label : undefined}
                className="w-full justify-start"
                aria-label={item.label}
              >
                <NavLink 
                  to={item.path} 
                  end={item.end}
                  className={({ isActive }) => 
                    isActive ? 'active-nav-link' : 'nav-link'
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {!collapsed && (
                    <span className="truncate ml-2">{item.label}</span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ), [collapsed, isActive]);

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-sidebar-border"
      aria-label="Main navigation"
    >
      <SidebarHeader className="border-b border-sidebar-border px-4 md:px-6 py-4 min-h-[73px] flex items-center">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden bg-sidebar-accent">
            <img 
              src={startersLogo} 
              alt="Starters Logo" 
              className="w-full h-full object-contain p-1.5" 
              loading="lazy" 
              width={56}
              height={56}
            />
          </div>
          {!collapsed && (
            <h1 className="text-2xl font-bold text-sidebar-foreground tracking-tight">
              Starters
            </h1>
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
