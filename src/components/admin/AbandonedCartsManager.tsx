import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getAbandonedCarts, getTimeAgo, type CartSession, type AbandonedCartFilters } from '@/api/cartSessions';
import { ShoppingCart, Mail, Phone, Clock, DollarSign, User, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomerDetailsModal } from '@/components/customers/CustomerDetailsModal';
import { supabase } from '@/integrations/supabase/client';

const AbandonedCartsManager = () => {
  const [filters, setFilters] = useState<AbandonedCartFilters>({
    timeRange: 'day',
    minValue: 0,
    page: 1,
    pageSize: 20
  });
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['abandoned-carts', filters],
    queryFn: () => getAbandonedCarts(filters),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleFilterChange = (key: keyof AbandonedCartFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset to page 1 when other filters change
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(value);
  };

  const getCartValue = (cart: CartSession) => {
    return cart.total_value || 0;
  };

  const handleViewCustomer = async (cart: CartSession) => {
    if (!cart.customer_email) return;
    
    try {
      // Fetch customer details from the customers table with order statistics
      const { data: customerData } = await supabase
        .from('customers')
        .select(`
          *,
          orders:orders(count),
          total_spent:orders(total_amount)
        `)
        .eq('email', cart.customer_email)
        .single();
      
      if (customerData) {
        // Calculate total spent
        const totalSpent = customerData.total_spent?.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0) || 0;
        const totalOrders = customerData.orders?.[0]?.count || 0;
        
        setSelectedCustomer({
          ...customerData,
          totalSpent,
          totalOrders,
          cart_session: cart
        });
        setIsCustomerModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
      // Fallback with basic info
      setSelectedCustomer({
        id: cart.session_id,
        name: cart.customer_email?.split('@')[0] || 'Customer',
        email: cart.customer_email || '',
        phone: cart.customer_phone || '',
        totalSpent: cart.total_value || 0,
        totalOrders: 0,
        created_at: cart.created_at || new Date().toISOString(),
        cart_session: cart
      });
      setIsCustomerModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Abandoned Carts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-destructive">Failed to load abandoned carts</p>
          <Button onClick={() => refetch()} className="mt-2">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { carts, count } = data || { carts: [], count: 0 };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Abandoned Carts ({count})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <Select 
              value={filters.timeRange} 
              onValueChange={(value) => handleFilterChange('timeRange', value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Last Hour</SelectItem>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Min cart value"
              value={filters.minValue || ''}
              onChange={(e) => handleFilterChange('minValue', Number(e.target.value) || 0)}
              className="w-40"
            />
          </div>

          {/* Cart List */}
          <div className="space-y-4">
            {carts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No abandoned carts found</p>
              </div>
            ) : (
              carts.map((cart) => (
                <div key={cart.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {cart.customer_email && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {cart.customer_email}
                          </Badge>
                        )}
                        {cart.customer_phone && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {cart.customer_phone}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                          <span>{cart.total_items} items</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatCurrency(getCartValue(cart))}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{getTimeAgo(cart.abandoned_at || cart.last_activity)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {cart.customer_email && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewCustomer(cart)}
                        >
                          <User className="h-4 w-4 mr-1" />
                          View Customer
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </Button>
                    </div>
                  </div>

                  {/* Enhanced Cart Items Preview */}
                  {cart.cart_data && Array.isArray(cart.cart_data) && cart.cart_data.length > 0 && (
                    <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
                      <p className="font-medium mb-2 text-sm">Cart Items:</p>
                      <div className="space-y-2">
                        {cart.cart_data.slice(0, 4).map((item: any, index: number) => {
                          const itemPrice = item.price || item.unit_price || 0;
                          const quantity = item.quantity || 1;
                          const total = itemPrice * quantity;
                          
                          return (
                            <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded text-xs">
                              <div className="flex-1">
                                <span className="font-medium">{item.name || item.title || 'Product'}</span>
                                {item.image_url && (
                                  <div className="w-8 h-8 mt-1 rounded overflow-hidden inline-block mr-2">
                                    <img 
                                      src={item.image_url} 
                                      alt={item.name} 
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div>Qty: {quantity}</div>
                                <div className="font-medium">{formatCurrency(total)}</div>
                              </div>
                            </div>
                          );
                        })}
                        {cart.cart_data.length > 4 && (
                          <div className="text-center py-1 text-muted-foreground">
                            +{cart.cart_data.length - 4} more items
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {count > (filters.pageSize || 20) && (
            <div className="flex justify-center mt-6">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === 1}
                  onClick={() => handleFilterChange('page', (filters.page || 1) - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {filters.page || 1} of {Math.ceil(count / (filters.pageSize || 20))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filters.page || 1) >= Math.ceil(count / (filters.pageSize || 20))}
                  onClick={() => handleFilterChange('page', (filters.page || 1) + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <CustomerDetailsModal
          open={isCustomerModalOpen}
          onOpenChange={setIsCustomerModalOpen}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
};

export default AbandonedCartsManager;