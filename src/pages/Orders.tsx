
import React, { useState } from 'react';
import OrdersHeader from '@/components/orders/OrdersHeader';
import OrdersFilter from '@/components/orders/OrdersFilter';
import OrdersTable from '@/components/orders/OrdersTable';
import OrdersPagination from '@/components/orders/OrdersPagination';
import { useQuery, keepPreviousData, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrders, OrderWithItems, deleteOrder, bulkDeleteOrders } from '@/api/orders';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatus } from '@/types/orders';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const Orders = () => {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<OrderWithItems | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const PAGE_SIZE = 10;

  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const deleteOrderMutation = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Success', description: 'Order deleted successfully' });
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete order',
        variant: 'destructive'
      });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteOrders,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ 
        title: 'Success', 
        description: `${selectedOrders.length} order${selectedOrders.length > 1 ? 's' : ''} deleted successfully`
      });
      setSelectedOrders([]);
      setBulkDeleteConfirmOpen(false);
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete orders',
        variant: 'destructive'
      });
    }
  });

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

  const handleDeleteOrder = (order: OrderWithItems) => {
    setOrderToDelete(order);
    setDeleteConfirmOpen(true);
  };

  const handleSelectOrder = (orderId: string, selected: boolean) => {
    setSelectedOrders(prev => 
      selected 
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedOrders(selected ? orders.map(order => order.id) : []);
  };

  const handleBulkDelete = () => {
    setBulkDeleteConfirmOpen(true);
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
      <OrdersHeader 
        selectedCount={selectedOrders.length}
        onBulkDelete={handleBulkDelete}
      />
      <OrdersFilter 
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        onSearch={handleSearch}
      />
      <OrdersTable 
        orders={orders} 
        onViewOrder={handleViewOrder}
        onDeleteOrder={handleDeleteOrder}
        selectedOrders={selectedOrders}
        onSelectOrder={handleSelectOrder}
        onSelectAll={handleSelectAll}
      />
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order {orderToDelete?.order_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => orderToDelete && deleteOrderMutation.mutate(orderToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedOrders)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Orders;
