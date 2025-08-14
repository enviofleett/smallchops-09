import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingBag, Package, Clock, CheckCircle, Eye, RotateCcw, Search, Filter, MapPin, User, Phone, Calendar, Package2 } from 'lucide-react';
import { useOrderSummary } from '@/hooks/useOrderSummary';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceDisplay } from '@/components/ui/price-display';
import { SafeHtml } from '@/components/ui/safe-html';

interface OrderSummaryProps {
  detailed?: boolean;
}

export function OrderSummary({ detailed = false }: OrderSummaryProps) {
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    page: 1,
    limit: 10
  });
  
  const { orders, totalCount, isLoading, isError, error, refetch } = useOrderSummary(filters);

  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status, page: 1 }));
  };

  const handleSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-48" />
        </div>
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to load order history</h3>
        <p className="text-muted-foreground mb-4">
          {error instanceof Error ? error.message : 'There was a problem loading your orders.'}
        </p>
        <Button onClick={() => refetch()}>
          Try Again
        </Button>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'confirmed':
      case 'preparing':
      case 'ready':
        return <Package className="w-4 h-4 text-primary" />;
      case 'out_for_delivery':
        return <Package2 className="w-4 h-4 text-warning" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'cancelled':
        return <Clock className="w-4 h-4 text-destructive" />;
      default:
        return <ShoppingBag className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'default';
      case 'confirmed':
      case 'preparing':
      case 'ready':
        return 'secondary';
      case 'out_for_delivery':
        return 'outline';
      case 'pending':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'out_for_delivery':
        return 'Out for Delivery';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Order History
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            View orders older than 30 days ({totalCount} orders found)
          </p>
        </div>
        
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number or name..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filters.status} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders List */}
      {orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Order Header */}
                <div className="p-4 sm:p-6 border-b bg-muted/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(order.status)}
                      <div>
                        <h3 className="font-semibold text-base sm:text-lg">
                          Order #{order.order_number}
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(order.order_time), 'PPP')}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.customer_name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <PriceDisplay 
                        originalPrice={order.total_amount}
                        size="lg"
                        className="font-bold"
                      />
                      <Badge 
                        variant={getStatusColor(order.status) as any}
                        className="w-fit"
                      >
                        {getStatusLabel(order.status)}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Delivery Information */}
                  {order.delivery_address && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Delivery Address
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {typeof order.delivery_address === 'string' 
                          ? order.delivery_address 
                          : `${order.delivery_address.address_line_1}${order.delivery_address.address_line_2 ? ', ' + order.delivery_address.address_line_2 : ''}, ${order.delivery_address.city}, ${order.delivery_address.state}`
                        }
                      </p>
                    </div>
                  )}

                  {/* Special Instructions */}
                  {order.special_instructions && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium text-sm mb-2">Special Instructions</h4>
                      <p className="text-sm text-muted-foreground">
                        {order.special_instructions}
                      </p>
                    </div>
                  )}

                  {/* Order Items */}
                  <div>
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Items ({order.order_items.length})
                    </h4>
                    <div className="space-y-3">
                      {order.order_items.map((item, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                          {item.products?.image_url && (
                            <img
                              src={item.products.image_url}
                              alt={item.products?.name || item.product_name}
                              className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-sm sm:text-base truncate">
                              {item.products?.name || item.product_name}
                            </h5>
                            {item.products?.description && (
                              <SafeHtml 
                                className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2"
                              >
                                {item.products.description}
                              </SafeHtml>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs sm:text-sm text-muted-foreground">
                                Qty: {item.quantity}
                              </span>
                              <div className="text-right">
                                <PriceDisplay
                                  originalPrice={item.unit_price}
                                  size="sm"
                                  className="text-xs sm:text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Total: {formatCurrency(item.total_price)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                    {(order.status === 'completed' || order.status === 'delivered') && (
                      <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reorder
                      </Button>
                    )}
                    {order.payment_status === 'paid' && (
                      <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
                        Download Receipt
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No historical orders found</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {filters.search || filters.status !== 'all' 
              ? 'No orders match your current filters. Try adjusting your search or filter criteria.'
              : 'You don\'t have any orders older than 30 days yet. Your recent orders can be found in the "My Orders" section.'
            }
          </p>
          {(filters.search || filters.status !== 'all') && (
            <Button 
              variant="outline" 
              onClick={() => setFilters({ status: 'all', search: '', page: 1, limit: 10 })}
            >
              Clear Filters
            </Button>
          )}
        </Card>
      )}

      {/* Pagination */}
      {orders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, totalCount)} of {totalCount} orders
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page * filters.limit >= totalCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );

}