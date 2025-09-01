import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { format, isToday, isYesterday, subDays, isSameDay } from 'date-fns';

interface OverdueDateFilterProps {
  selectedDateFilter: string | null;
  onDateFilterChange: (filter: string | null) => void;
  overdueOrderCounts: {
    today: number;
    yesterday: number;
    lastWeek: number;
    older: number;
  };
}

export function OverdueDateFilter({
  selectedDateFilter,
  onDateFilterChange,
  overdueOrderCounts
}: OverdueDateFilterProps) {
  const dateFilters = [
    { 
      value: 'today', 
      label: 'Overdue Today', 
      count: overdueOrderCounts.today,
      description: 'Orders that became overdue today'
    },
    { 
      value: 'yesterday', 
      label: 'Overdue Yesterday', 
      count: overdueOrderCounts.yesterday,
      description: 'Orders that became overdue yesterday'
    },
    { 
      value: 'last_week', 
      label: 'Last 7 Days', 
      count: overdueOrderCounts.lastWeek,
      description: 'Orders overdue in the last 7 days'
    },
    { 
      value: 'older', 
      label: 'Older', 
      count: overdueOrderCounts.older,
      description: 'Orders overdue for more than 7 days'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Mobile: Stacked buttons */}
      <div className="block sm:hidden">
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant={selectedDateFilter === null ? "default" : "outline"}
            onClick={() => onDateFilterChange(null)}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              All Overdue Orders
            </span>
            <Badge variant="secondary" className="ml-2">
              {Object.values(overdueOrderCounts).reduce((a, b) => a + b, 0)}
            </Badge>
          </Button>
          
          {dateFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={selectedDateFilter === filter.value ? "default" : "outline"}
              onClick={() => onDateFilterChange(filter.value)}
              className="w-full justify-between"
              disabled={filter.count === 0}
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {filter.label}
              </span>
              <Badge 
                variant={filter.count > 0 ? "destructive" : "secondary"} 
                className="ml-2"
              >
                {filter.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Tablet: 2-column grid */}
      <div className="hidden sm:block md:hidden">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={selectedDateFilter === null ? "default" : "outline"}
            onClick={() => onDateFilterChange(null)}
            className="justify-between col-span-2"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              All Overdue Orders
            </span>
            <Badge variant="secondary">
              {Object.values(overdueOrderCounts).reduce((a, b) => a + b, 0)}
            </Badge>
          </Button>
          
          {dateFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={selectedDateFilter === filter.value ? "default" : "outline"}
              onClick={() => onDateFilterChange(filter.value)}
              className="justify-between"
              disabled={filter.count === 0}
            >
              <span className="flex items-center gap-2 truncate">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{filter.label}</span>
              </span>
              <Badge 
                variant={filter.count > 0 ? "destructive" : "secondary"} 
                className="ml-2 flex-shrink-0"
              >
                {filter.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Desktop: Horizontal layout with select dropdown */}
      <div className="hidden md:flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-sm">Filter by overdue period:</span>
        </div>
        
        <Select 
          value={selectedDateFilter || 'all'} 
          onValueChange={(value) => onDateFilterChange(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center justify-between w-full">
                <span>All Overdue Orders</span>
                <Badge variant="secondary" className="ml-2">
                  {Object.values(overdueOrderCounts).reduce((a, b) => a + b, 0)}
                </Badge>
              </div>
            </SelectItem>
            {dateFilters.map((filter) => (
              <SelectItem key={filter.value} value={filter.value} disabled={filter.count === 0}>
                <div className="flex items-center justify-between w-full">
                  <span>{filter.label}</span>
                  <Badge 
                    variant={filter.count > 0 ? "destructive" : "secondary"} 
                    className="ml-2"
                  >
                    {filter.count}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Quick action buttons for most common filters */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant={selectedDateFilter === 'today' ? "default" : "outline"}
            size="sm"
            onClick={() => onDateFilterChange('today')}
            disabled={overdueOrderCounts.today === 0}
          >
            Today ({overdueOrderCounts.today})
          </Button>
          <Button
            variant={selectedDateFilter === 'yesterday' ? "default" : "outline"}
            size="sm"
            onClick={() => onDateFilterChange('yesterday')}
            disabled={overdueOrderCounts.yesterday === 0}
          >
            Yesterday ({overdueOrderCounts.yesterday})
          </Button>
        </div>
      </div>

      {/* Active filter description */}
      {selectedDateFilter && (
        <div className="bg-muted/50 rounded-lg p-3 border-l-4 border-destructive">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-destructive" />
            <span className="font-medium">
              {dateFilters.find(f => f.value === selectedDateFilter)?.description}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}