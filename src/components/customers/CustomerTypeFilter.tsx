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
  const filters = [
    {
      key: 'all' as CustomerTypeFilter,
      label: 'All Customers',
      icon: Users,
      count: safeCounts.all,
      description: 'All customer records',
      variant: 'default' as const,
      activeClass: 'bg-primary text-primary-foreground border-primary'
    },
    {
      key: 'authenticated' as CustomerTypeFilter,
      label: 'Authenticated',
      icon: UserCheck,
      count: safeCounts.authenticated,
      description: 'Customers with accounts',
      variant: 'secondary' as const,
      activeClass: 'bg-secondary text-secondary-foreground border-secondary'
    },
    {
      key: 'guest' as CustomerTypeFilter,
      label: 'Guest',
      icon: UserX,
      count: safeCounts.guest,
      description: 'One-time guest customers',
      variant: 'outline' as const,
      activeClass: 'bg-accent text-accent-foreground border-accent'
    }
  ];

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = currentFilter === filter.key;
        
        return (
          <Button
            key={filter.key}
            variant={isActive ? filter.variant : "outline"}
            onClick={() => onFilterChange(filter.key)}
            disabled={isLoading}
            className={`
              group relative flex items-center gap-2 px-4 py-2.5 h-auto
              transition-all duration-200 hover:scale-105
              ${isActive ? filter.activeClass : 'hover:bg-muted/50'}
            `}
            title={`${filter.description} (${filter.count} total)`}
          >
            <Icon className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{filter.label}</span>
              <span className="text-xs opacity-80">{filter.count} customers</span>
            </div>
            
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-background/50 rounded-md flex items-center justify-center">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              </div>
            )}
          </Button>
        );
      })}
      
      {/* Summary info */}
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <span>Total: {safeCounts.all}</span>
        {safeCounts.authenticated > 0 && (
          <span className="text-green-600">
            {Math.round((safeCounts.authenticated / safeCounts.all) * 100)}% authenticated
          </span>
        )}
      </div>
    </div>
  );
};