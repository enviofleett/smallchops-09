import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrdersList } from './OrdersList';
import { OrderFilters } from './OrderFilters';
import { OrderDetailsModal } from './OrderDetailsModal';
import { useOrdersQuery } from '@/hooks/useOrdersQuery';
import { OrderStatus } from '@/types/orders';
import { OrderWithItems } from '@/api/orders';

interface OrderFilters {
  status: OrderStatus | 'all';
  searchQuery: string;
  startDate?: string;
  endDate?: string;
}

const defaultFilters: OrderFilters = {
  status: 'all',
  searchQuery: '',
};

export const OrderManagementDashboard = () => {
  const [filters, setFilters] = useState<OrderFilters>(defaultFilters);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const {
    data: orders,
    isLoading,
    error,
    refetch
  } = useOrdersQuery({ 
    filters: {
      status: filters.status,
      searchQuery: filters.searchQuery,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }
  });

  const handleOrderSelect = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };

  const handleFiltersChange = (newFilters: Partial<OrderFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            Error loading orders: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderFilters 
            filters={filters} 
            onChange={handleFiltersChange}
          />
          
          <div className="mt-6">
            <OrdersList
              orders={orders?.orders || []}
              view={view}
              isLoading={isLoading}
              error={error}
              onOrderSelect={handleOrderSelect}
              onRefresh={refetch}
            />
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedOrder(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};