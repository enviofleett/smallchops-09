import React, { useState } from 'react';
import { useOrdersQuery } from '@/hooks/useOrdersQuery';
import { OrderWithItems } from '@/api/orders';
import { EnhancedOrderFilters } from '@/components/orders/EnhancedOrderFilters';
import { EnhancedOrderUpdateModal } from '@/components/orders/EnhancedOrderUpdateModal';
import { OrderAuditLogViewer } from '@/components/orders/OrderAuditLogViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { 
  Edit, 
  Eye, 
  Package, 
  Clock, 
  User, 
  CreditCard, 
  MapPin,
  TrendingUp 
} from 'lucide-react';

interface AdminOrderFilters {
  status?: string;
  paymentStatus?: string;
  orderType?: string;
  searchQuery?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export const EnhancedAdminOrders: React.FC = () => {
  const [filters, setFilters] = useState<AdminOrderFilters>({
    status: 'all',
    paymentStatus: 'all',
    orderType: 'all',
    searchQuery: '',
  });
  
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  const { data, isLoading, refetch } = useOrdersQuery({
    filters: {
      status: (filters.status as any) || 'all',
      searchQuery: filters.searchQuery || '',
    },
  });

  const orders = data?.orders || [];
  const totalCount = data?.count || 0;

  const handleOrderUpdated = (updatedOrder: OrderWithItems) => {
    refetch();
    setShowUpdateModal(false);
    setSelectedOrder(null);
  };

  const handleEditOrder = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setShowUpdateModal(true);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-700',
      'confirmed': 'bg-blue-100 text-blue-700',
      'preparing': 'bg-orange-100 text-orange-700',
      'ready': 'bg-purple-100 text-purple-700',
      'out_for_delivery': 'bg-indigo-100 text-indigo-700',
      'delivered': 'bg-green-100 text-green-700',
      'cancelled': 'bg-red-100 text-red-700',
      'completed': 'bg-emerald-100 text-emerald-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-700',
      'paid': 'bg-green-100 text-green-700',
      'failed': 'bg-red-100 text-red-700',
      'refunded': 'bg-gray-100 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Package className="h-8 w-8 animate-pulse mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Enhanced Order Management</h1>
          <p className="text-muted-foreground">
            Advanced order management with comprehensive filtering and audit logging
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAuditPanel(!showAuditPanel)}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {showAuditPanel ? 'Hide' : 'Show'} Admin Actions
          </Button>
        </div>
      </div>

      {/* Enhanced Filters */}
      <EnhancedOrderFilters
        filters={filters as any}
        onFiltersChange={setFilters as any}
        totalCount={totalCount}
        filteredCount={orders.length}
        onExport={() => console.log('Export functionality')}
      />

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          {showAuditPanel && <TabsTrigger value="audit">Admin Actions</TabsTrigger>}
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {/* Orders Grid */}
          <div className="grid gap-4">
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium text-lg">{order.order_number}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                      <Badge className={getPaymentStatusColor(order.payment_status)}>
                        {order.payment_status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{order.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{order.customer_email}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">₦{order.total_amount?.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{order.order_type}</div>
                      </div>
                    </div>
                    
                    {order.order_type === 'delivery' && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          {typeof order.delivery_address === 'string' 
                            ? order.delivery_address.slice(0, 30) + '...'
                            : 'Delivery address set'
                          }
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div className="text-sm">
                        Updated {format(new Date(order.updated_at), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {order.order_items?.length || 0} items
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => console.log('View order:', order.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditOrder(order)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {orders.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No orders found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters to see more orders.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {showAuditPanel && (
          <TabsContent value="audit">
            <OrderAuditLogViewer showAllAdminActions={true} />
          </TabsContent>
        )}
      </Tabs>

      {/* Enhanced Order Update Modal */}
      <EnhancedOrderUpdateModal
        order={selectedOrder}
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedOrder(null);
        }}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
};