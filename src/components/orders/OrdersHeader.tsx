
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface OrdersHeaderProps {
  selectedCount?: number;
  onBulkDelete?: () => void;
}

const OrdersHeader = ({ selectedCount = 0, onBulkDelete }: OrdersHeaderProps) => {
  return (
    <div className="flex flex-col space-y-3 md:space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
      <div>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Manage and track all your orders</p>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            onClick={onBulkDelete}
            size="sm"
            className="flex items-center justify-center gap-2 min-h-[36px] md:min-h-[44px] text-xs md:text-sm"
          >
            <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
            Delete {selectedCount} Order{selectedCount > 1 ? 's' : ''}
          </Button>
        )}
        <Button 
          variant="default"
          size="sm"
          className="min-h-[36px] md:min-h-[44px] text-xs md:text-sm px-3 md:px-6 bg-gradient-to-r from-primary to-primary/80"
        >
          Export Orders
        </Button>
      </div>
    </div>
  );
};

export default OrdersHeader;
