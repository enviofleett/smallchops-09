import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Eye, Clock, MapPin, User, Phone } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow } from '@/components/ui/responsive-table';
import { OrderWithItems } from '@/api/orders';
import { Loader2 } from 'lucide-react';

interface OrdersListProps {
  orders: OrderWithItems[];
  view: 'list' | 'grid';
  isLoading: boolean;
  error: Error | null;
  onOrderSelect: (order: OrderWithItems) => void;
  onRefresh: () => void;
  deliverySchedules?: Record<string, any>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'confirmed': return 'bg-blue-100 text-blue-800';
    case 'preparing': return 'bg-orange-100 text-orange-800';
    case 'ready': return 'bg-green-100 text-green-800';
    case 'out_for_delivery': return 'bg-purple-100 text-purple-800';
    case 'delivered': return 'bg-emerald-100 text-emerald-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const OrdersList: React.FC<OrdersListProps> = ({
  orders,
  view,
  isLoading,
  error,
  onOrderSelect,
  onRefresh,
  deliverySchedules = {}
}) => {
  const isMobile = useIsMobile();
  
  const isExpired = (order: OrderWithItems) => {
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return false;
    }
    
    const schedule = deliverySchedules[order.id];
    if (!schedule?.delivery_date || !schedule?.delivery_time_end) {
      return false;
    }
    
    try {
      const deliveryEndTime = new Date(`${schedule.delivery_date}T${schedule.delivery_time_end}`);
      return !isNaN(deliveryEndTime.getTime()) && deliveryEndTime < new Date();
    } catch {
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Error loading orders: {error.message}</p>
        <Button onClick={onRefresh} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No orders found
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        {orders.map((order) => {
          const expired = isExpired(order);
          return (
            <MobileCard key={order.id} className={`border ${expired ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
              <MobileCardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{order.order_number}</h3>
                      {expired && (
                        <Badge variant="destructive" className="text-xs">
                          EXPIRED
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </MobileCardHeader>
            
            <MobileCardContent>
              <MobileCardRow 
                label="Email" 
                value={
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{order.customer_email}</span>
                  </div>
                }
              />
              
              <MobileCardRow 
                label="Phone" 
                value={
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{order.customer_phone}</span>
                  </div>
                }
              />
              
              <MobileCardRow 
                label="Created" 
                value={
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                }
              />
              
              <MobileCardRow 
                label="Total" 
                value={
                  <div className="flex justify-between items-center w-full">
                    <span className="font-semibold">₦{order.total_amount.toLocaleString()}</span>
                    <Button 
                      size="sm" 
                      onClick={() => onOrderSelect(order)}
                      className="h-8"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                }
              />
            </MobileCardContent>
          </MobileCard>
        );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const expired = isExpired(order);
        return (
          <div 
            key={order.id} 
            className={`border rounded-lg p-4 hover:bg-accent/50 transition-colors ${expired ? 'border-destructive bg-destructive/5' : 'border-border'}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{order.order_number}</h3>
                  {expired && (
                    <Badge variant="destructive" className="text-xs">
                      EXPIRED
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{order.customer_name}</p>
              </div>
              <Badge className={getStatusColor(order.status)}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{order.customer_email}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{order.customer_phone}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm capitalize">{order.order_type}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-semibold text-lg">₦{order.total_amount.toLocaleString()}</span>
            <Button onClick={() => onOrderSelect(order)}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </div>
        </div>
      );
      })}
    </div>
  );
};