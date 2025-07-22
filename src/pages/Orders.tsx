
import React, { useState } from 'react';
import OrdersHeader from '@/components/orders/OrdersHeader';
import OrdersFilter from '@/components/orders/OrdersFilter';
import OrdersTable from '@/components/orders/OrdersTable';
import OrdersPagination from '@/components/orders/OrdersPagination';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatus } from '@/types/orders';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';

const Orders = () => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const PAGE_SIZE = 10;

  const { data, isLoading, isError, error } = useQuery<{
    orders: OrderWithItems[];
    count: number;
  }>({
    queryKey: ['orders', { currentPage, statusFilter, searchQuery }],
    queryFn: () => getOrders({ 
      page: currentPage, 
      pageSize: PAGE_SIZE, 
      status: statusFilter,
      searchQuery 
    }),
    placeholderData: keepPreviousData,
  });

  const orders = data?.orders ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleStatusChange = (status: string) => {
    setStatusFilter(status as OrderStatus | 'all');
    setCurrentPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleViewOrder = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedOrder(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <OrdersHeader />
        <OrdersFilter 
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          onSearch={handleSearch}
        />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <OrdersHeader />
        <OrdersFilter 
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          onSearch={handleSearch}
        />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load orders.</p>
          <p className="text-gray-500 text-sm mt-1">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrdersHeader />
      <OrdersFilter 
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        onSearch={handleSearch}
      />
      <OrdersTable orders={orders} onViewOrder={handleViewOrder} />
      <OrdersPagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalResults={totalCount}
        pageSize={PAGE_SIZE}
      />
      {selectedOrder && (
        <OrderDetailsDialog 
          isOpen={isDialogOpen}
          onClose={handleCloseDialog}
          order={selectedOrder}
        />
      )}
    </div>
  );
};

export default Orders;
