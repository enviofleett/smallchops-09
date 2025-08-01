
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface OrdersHeaderProps {
  selectedCount?: number;
  onBulkDelete?: () => void;
}

const OrdersHeader = ({ selectedCount = 0, onBulkDelete }: OrdersHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Orders</h1>
        <p className="text-gray-600 mt-2">Manage and track all your orders</p>
      </div>
      <div className="flex items-center gap-3 mt-4 sm:mt-0">
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            onClick={onBulkDelete}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete {selectedCount} Order{selectedCount > 1 ? 's' : ''}
          </Button>
        )}
        <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg transition-all">
          Export Orders
        </button>
      </div>
    </div>
  );
};

export default OrdersHeader;
