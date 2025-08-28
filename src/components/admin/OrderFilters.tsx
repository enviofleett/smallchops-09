import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { OrderStatus } from '@/types/orders';

interface OrderFiltersProps {
  filters: {
    status: OrderStatus | 'all';
    searchQuery: string;
    startDate?: string;
    endDate?: string;
  };
  onChange: (filters: Partial<OrderFiltersProps['filters']>) => void;
}

export const OrderFilters: React.FC<OrderFiltersProps> = ({ filters, onChange }) => {
  const handleClearFilters = () => {
    onChange({
      status: 'all',
      searchQuery: '',
      startDate: undefined,
      endDate: undefined,
    });
  };

  const hasActiveFilters = filters.status !== 'all' || 
    filters.searchQuery || 
    filters.startDate || 
    filters.endDate;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Search Orders</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by order number, customer name, email, or phone..."
              value={filters.searchQuery}
              onChange={(e) => onChange({ searchQuery: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="sm:w-48">
          <Label htmlFor="status">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => onChange({ status: value as OrderStatus | 'all' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onChange({ startDate: e.target.value || undefined })}
          />
        </div>
        
        <div className="flex-1">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => onChange({ endDate: e.target.value || undefined })}
          />
        </div>
        
        {hasActiveFilters && (
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};