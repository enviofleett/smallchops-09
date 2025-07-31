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
}

export const CustomerTypeFilter = ({ 
  currentFilter, 
  onFilterChange, 
  counts 
}: CustomerTypeFilterProps) => {
  const filters = [
    {
      key: 'all' as CustomerTypeFilter,
      label: 'All Customers',
      icon: Users,
      count: counts.all,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      activeBg: 'bg-blue-100'
    },
    {
      key: 'authenticated' as CustomerTypeFilter,
      label: 'Authenticated',
      icon: UserCheck,
      count: counts.authenticated,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      activeBg: 'bg-green-100'
    },
    {
      key: 'guest' as CustomerTypeFilter,
      label: 'Guest',
      icon: UserX,
      count: counts.guest,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      activeBg: 'bg-orange-100'
    }
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = currentFilter === filter.key;
        
        return (
          <Button
            key={filter.key}
            variant={isActive ? "default" : "outline"}
            onClick={() => onFilterChange(filter.key)}
            className={`flex items-center gap-2 ${
              isActive 
                ? `${filter.activeBg} ${filter.color} border-transparent` 
                : `${filter.bgColor} ${filter.color} hover:${filter.activeBg}`
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{filter.label}</span>
            <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full bg-white/80">
              {filter.count}
            </span>
          </Button>
        );
      })}
    </div>
  );
};