
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import AbandonedCartsManager from '@/components/admin/AbandonedCartsManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrdersErrorBoundary from '@/components/orders/OrdersErrorBoundary';
import { supabase } from '@/integrations/supabase/client';
import { runPaystackBatchVerify } from '@/utils/paystackBatchVerify';

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

  // Realtime: auto-refresh when orders change
  React.useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Realtime: also refresh when payment transactions change
  React.useEffect(() => {
    const channel = supabase
      .channel('payment-transactions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['payment_tx_for_orders'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

// Derive "paid" display from payment_transactions for currently loaded orders
const orderIds = React.useMemo(() => orders.map(o => o.id), [orders]);
const refs = React.useMemo(() => orders.map(o => (o as any).payment_reference).filter(Boolean) as string[], [orders]);

const { data: txData } = useQuery({
  queryKey: ['payment_tx_for_orders', orderIds],
  enabled: orderIds.length > 0,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('order_id,status,paid_at')
      .in('order_id', orderIds);
    if (error) throw new Error(error.message);
    return data as Array<{ order_id: string; status: string | null; paid_at: string | null }>;
  }
});

const { data: txByRef } = useQuery({
  queryKey: ['payment_tx_by_ref', refs],
  enabled: refs.length > 0,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('provider_reference,status,paid_at')
      .in('provider_reference', refs);
    if (error) throw new Error(error.message);
    return data as Array<{ provider_reference: string; status: string | null; paid_at: string | null }>;
  }
});

const paidMap = React.useMemo(() => {
  const m = new Map<string, boolean>();
  (txData || []).forEach(tx => {
    const st = (tx.status || '').toLowerCase();
    if (st === 'success' || st === 'paid' || !!tx.paid_at) {
      m.set(tx.order_id, true);
    }
  });
  return m;
}, [txData]);

const paidByRefMap = React.useMemo(() => {
  const m = new Map<string, boolean>();
  (txByRef || []).forEach(tx => {
    const st = (tx.status || '').toLowerCase();
    if (st === 'success' || st === 'paid' || !!tx.paid_at) {
      m.set(tx.provider_reference, true);
    }
  });
  return m;
}, [txByRef]);

const adjustedOrders = React.useMemo(() => {
  if (!orders?.length) return orders;
  return orders.map(o => {
    const finalPaidFlag = (o as any).final_paid as boolean | undefined;
    if (typeof finalPaidFlag !== 'undefined') {
      return finalPaidFlag ? { ...o, payment_status: 'paid' as any } : o;
    }
    return (
      paidMap.get(o.id) || paidByRefMap.get((o as any).payment_reference) || o.payment_status === 'paid' || (o as any).paid_at
        ? { ...o, payment_status: 'paid' as any }
        : o
    );
  });
}, [orders, paidMap, paidByRefMap]);

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

  const handleReconcilePayments = async () => {
    try {
      const res = await runPaystackBatchVerify({ limit: 200, dryRun: false });
      if ((res as any)?.error) throw new Error((res as any).error);
      toast({ title: 'Reconcile started', description: 'Batch verify invoked. Refreshing orders…' });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (e: any) {
      toast({ title: 'Reconcile failed', description: e.message || 'Unable to run batch verify', variant: 'destructive' });
    }
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
    <OrdersErrorBoundary>
      <div className="space-y-6">
        <OrdersHeader 
          selectedCount={selectedOrders.length}
          onBulkDelete={handleBulkDelete}
        />
        
        <Tabs defaultValue="orders" className="w-full">
          <TabsList>
            <TabsTrigger value="orders">Active Orders</TabsTrigger>
            <TabsTrigger value="abandoned">Abandoned Carts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="orders" className="space-y-6">
            <OrdersFilter 
              statusFilter={statusFilter}
              onStatusChange={handleStatusChange}
              onSearch={handleSearch}
            />
            <div className="flex justify-end">
              <Button onClick={handleReconcilePayments} variant="secondary">Reconcile Payments</Button>
            </div>
<OrdersTable 
  orders={adjustedOrders} 
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
          </TabsContent>
          
          <TabsContent value="abandoned">
            <AbandonedCartsManager />
          </TabsContent>
        </Tabs>
        
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
    </OrdersErrorBoundary>
  );
};

export default Orders;
