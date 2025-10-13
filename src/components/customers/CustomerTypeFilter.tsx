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
  
  return (
    <div className="flex gap-2 flex-wrap">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = currentFilter === filter.key;
        
        return (
          <Button
            key={filter.key}
            variant={isActive ? filter.variant : 'outline'}
            size="sm"
            onClick={() => onFilterChange(filter.key)}
            disabled={isLoading}
            className={`transition-all ${isActive ? filter.activeClass : ''}`}
            title={filter.description}
          >
            <Icon className="h-4 w-4 mr-2" />
            <span className="font-medium">{filter.label}</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-background/50 text-xs font-bold">
              {isLoading ? '...' : filter.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
};