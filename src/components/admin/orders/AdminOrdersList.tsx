import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { EnhancedOrderCard } from '@/components/admin/EnhancedOrderCard';
import { MobileOrderTabs } from './MobileOrderTabs';
import { OrderWithItems } from '@/api/orders';

interface AdminOrdersListProps {
  orders: OrderWithItems[];
  isLoading: boolean;
  error: any;
  selectedOrder: OrderWithItems | null;
  setSelectedOrder: (order: OrderWithItems | null) => void;
  setIsDialogOpen: (open: boolean) => void;
  deliverySchedules: Record<string, any>;
  activeTab: string;
  statusFilter: string;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  showPreview: (order: OrderWithItems, schedule?: any, businessInfo?: any) => void;
  isMobile: boolean;
}

export function AdminOrdersList({
  orders,
  isLoading,
  error,
  selectedOrder,
  setSelectedOrder,
  setIsDialogOpen,
  deliverySchedules,
  activeTab,
  statusFilter,
  currentPage,
  setCurrentPage,
  totalPages,
  showPreview,
  isMobile
}: AdminOrdersListProps) {
  const handleOrderSelect = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Orders</h3>
            <p className="text-muted-foreground mb-4">
              There was an error loading the orders. Please try again.
            </p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
            <p className="text-muted-foreground">
              {statusFilter !== 'all' 
                ? `No orders found with the current filters.`
                : 'No orders have been placed yet.'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Order Tabs */}
      {isMobile && (
        <MobileOrderTabs
          orders={orders}
          activeTab={activeTab}
          onTabChange={() => {}} // Handled by parent
          onOrderSelect={handleOrderSelect}
          deliverySchedules={deliverySchedules}
          orderCounts={{
            all: orders.length,
            confirmed: orders.filter(o => o.status === 'confirmed').length,
            preparing: orders.filter(o => o.status === 'preparing').length,
            ready: orders.filter(o => o.status === 'ready').length,
            out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
            delivered: orders.filter(o => o.status === 'delivered').length,
            overdue: 0
          }}
        />
      )}

      {/* Desktop Order List */}
      {!isMobile && (
        <div className="space-y-4">
          {orders.map((order) => (
            <EnhancedOrderCard
              key={order.id}
              order={order}
              onOrderSelect={handleOrderSelect}
              deliverySchedule={deliverySchedules[order.id]}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}