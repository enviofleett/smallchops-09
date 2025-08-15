import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  History, 
  MapPin, 
  User, 
  Heart,
  Search
} from 'lucide-react';

export function CustomerNavigation() {
  const location = useLocation();

  const navItems = [
    {
      label: 'Track Order',
      href: '/track-order',
      icon: MapPin,
      description: 'Track your order in real-time'
    },
    {
      label: 'Order History',
      href: '/purchase-history',
      icon: History,
      description: 'View your past orders and receipts'
    },
    {
      label: 'Favorites',
      href: '/customer-favorites',
      icon: Heart,
      description: 'Your saved products'
    },
    {
      label: 'Profile',
      href: '/customer-profile',
      icon: User,
      description: 'Manage your account settings'
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;
        
        return (
          <Link key={item.href} to={item.href}>
            <Button
              variant={isActive ? 'default' : 'outline'}
              className="h-auto p-4 flex flex-col items-center gap-2 w-full"
            >
              <Icon className="w-6 h-6" />
              <div className="text-center">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground hidden md:block">
                  {item.description}
                </div>
              </div>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}