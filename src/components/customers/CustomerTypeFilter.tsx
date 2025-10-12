import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, UserX } from 'lucide-react';
export type CustomerTypeFilter = 'all' | 'authenticated' | 'guest';
interface CustomerTypeFilterProps {
  currentFilter: CustomerTypeFilter;
  onFilterChange: (filter: CustomerTypeFilter) => void;
  counts: {
    all: number;
    authenticated: number;
    guest: number;
  };
  isLoading?: boolean;
}
export const CustomerTypeFilter = ({
  currentFilter,
  onFilterChange,
  counts,
  isLoading = false
}: CustomerTypeFilterProps) => {
  // Production-ready data validation and safety checks
  const safeCounts = {
    all: Math.max(0, counts?.all || 0),
    authenticated: Math.max(0, counts?.authenticated || 0),
    guest: Math.max(0, counts?.guest || 0)
  };
  const filters = [{
    key: 'all' as CustomerTypeFilter,
    label: 'All Customers',
    icon: Users,
    count: safeCounts.all,
    description: 'All customer records',
    variant: 'default' as const,
    activeClass: 'bg-primary text-primary-foreground border-primary'
  }, {
    key: 'authenticated' as CustomerTypeFilter,
    label: 'Authenticated',
    icon: UserCheck,
    count: safeCounts.authenticated,
    description: 'Customers with accounts',
    variant: 'secondary' as const,
    activeClass: 'bg-secondary text-secondary-foreground border-secondary'
  }, {
    key: 'guest' as CustomerTypeFilter,
    label: 'Guest',
    icon: UserX,
    count: safeCounts.guest,
    description: 'One-time guest customers',
    variant: 'outline' as const,
    activeClass: 'bg-accent text-accent-foreground border-accent'
  }];
  return;
};