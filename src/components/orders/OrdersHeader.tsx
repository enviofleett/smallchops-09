
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface OrdersHeaderProps {
  selectedCount?: number;
  onBulkDelete?: () => void;
}

const OrdersHeader = ({ selectedCount = 0, onBulkDelete }: OrdersHeaderProps) => {
  return (
    <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-lg md:text-xl font-bold text-foreground">Order Management</h1>
        <p className="text-muted-foreground text-xs md:text-sm">Track and manage orders</p>
      </div>
      <div className="flex flex-row items-center gap-1 md:gap-2">
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            onClick={onBulkDelete}
            size="sm"
            className="flex items-center gap-1 h-7 md:h-8 text-xs px-2 md:px-3"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden xs:inline">Delete {selectedCount}</span>
            <span className="xs:hidden">{selectedCount}</span>
          </Button>
        )}
        <Button 
          variant="default"
          size="sm"
          className="h-7 md:h-8 text-xs px-2 md:px-3 bg-gradient-to-r from-primary to-primary/80"
        >
          <span className="hidden sm:inline">Export</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>
    </div>
  );
};

export default OrdersHeader;
