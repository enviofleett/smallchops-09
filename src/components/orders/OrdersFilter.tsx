
import React from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { OrderStatus } from '@/types/orders';

interface OrdersFilterProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  onSearch: (query: string) => void;
}

const statusOptions: { value: OrderStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for Delivery' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
];


const OrdersFilter = ({ statusFilter, onStatusChange, onSearch }: OrdersFilterProps) => {
  return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search by name, phone, or ID..."
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            
            <button className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 hover:bg-gray-100 transition-colors">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-gray-600">More Filters</span>
            </button>
          </div>
        </div>
      </div>
  );
};

export default OrdersFilter;
