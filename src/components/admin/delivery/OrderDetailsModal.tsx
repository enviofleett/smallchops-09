import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { toImagesArray } from '@/lib/imageUtils';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { ProductDetailCard } from '@/components/orders/ProductDetailCard';
import { OrderReceiptModal } from '@/components/customer/OrderReceiptModal';
import { format } from 'date-fns';
import { 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Package, 
  Printer,
  X,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  
  // Fetch detailed order data including product details
  const { data: detailedOrder, isLoading, error, refetch } = useDetailedOrderData(order?.id);
  const { data: businessSettings } = useBusinessSettings();

  // Local currency formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  // Show toast for errors
  useEffect(() => {
    if (error) {
      toast.error('Failed to load order details');
    }
  }, [error]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'preparing': return 'bg-orange-500/10 text-orange-700 border-orange-200';
      case 'ready': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'out_for_delivery': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      case 'delivered': return 'bg-green-600/10 text-green-800 border-green-300';
      case 'cancelled': return 'bg-red-500/10 text-red-700 border-red-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const formatAddress = (address: any) => {
    if (!address || typeof address !== 'object') return 'N/A';
    
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state
    ].filter(Boolean);
    
    return parts.join(', ') || 'N/A';
  };

  const handlePrint = () => {
    setIsReceiptModalOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          {/* Header with branding */}
          <DialogHeader className="flex flex-row items-center justify-between p-4 sm:p-6 pb-2 border-b shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {businessSettings?.logo_url ? (
                <img 
                  src={businessSettings.logo_url} 
                  alt={businessSettings.logo_alt_text || businessSettings.name || 'Starters'}
                  className="h-8 sm:h-10 w-auto object-contain shrink-0"
                />
              ) : (
                <div className="text-lg sm:text-xl font-bold text-primary shrink-0">
                  {businessSettings?.name || 'Starters'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl font-semibold truncate">
                  Order Details
                </DialogTitle>
                <p className="text-sm text-muted-foreground truncate">
                  {order?.order_number}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isLoading}
                className="hidden sm:flex"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-4 sm:px-6">
            <div className="space-y-4 sm:space-y-6 py-4">
              {/* Loading State */}
              {isLoading && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <Skeleton className="h-5 w-32" />
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <Skeleton className="h-5 w-32" />
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                    </Card>
                  </div>
                  <Card>
                    <CardHeader>
                      <Skeleton className="h-5 w-24" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex gap-3">
                            <Skeleton className="h-16 w-16 rounded" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                              <Skeleton className="h-3 w-1/4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardContent className="flex items-center gap-3 p-6">
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive">
                        Failed to load order details
                      </p>
                      <p className="text-sm text-destructive/80 mt-1">
                        {error instanceof Error ? error.message : 'An error occurred while loading the order details.'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      className="border-destructive/20 hover:bg-destructive/10"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Success State */}
              {!isLoading && !error && (detailedOrder || order) && (
                <>
                  {/* Order Status and Basic Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'PPp')}
                        </span>
                      </div>
                      <p className="font-semibold text-lg">
                        {formatCurrency(order.total_amount)}
                      </p>
                    </div>
                    
                    {/* Mobile Print Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrint}
                      className="sm:hidden w-full"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print Receipt
                    </Button>
                  </div>

                  {/* Two Column Layout - Mobile Responsive */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Customer Information */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <User className="w-4 h-4" />
                          Customer Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-2">
                          <User className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium break-words">{order.customer_name}</p>
                            <p className="text-sm text-muted-foreground">Customer</p>
                          </div>
                        </div>
                        
                        {order.customer_email && (
                          <div className="flex items-start gap-2">
                            <Mail className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm break-all">{order.customer_email}</p>
                              <p className="text-xs text-muted-foreground">Email</p>
                            </div>
                          </div>
                        )}
                        
                        {order.customer_phone && (
                          <div className="flex items-start gap-2">
                            <Phone className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">{order.customer_phone}</p>
                              <p className="text-xs text-muted-foreground">Phone</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Delivery Information */}
                    {order.order_type === 'delivery' && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <MapPin className="w-4 h-4" />
                            Delivery Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-relaxed break-words">{formatAddress(order.delivery_address)}</p>
                              <p className="text-xs text-muted-foreground">Delivery Address</p>
                            </div>
                          </div>
                          
                          {detailedOrder?.delivery_schedule && (
                            <div className="flex items-start gap-2">
                              <Clock className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm">
                                  {format(new Date(detailedOrder.delivery_schedule.delivery_date), 'PPP')}
                                  {detailedOrder.delivery_schedule.delivery_time_start && 
                                   detailedOrder.delivery_schedule.delivery_time_end && (
                                    <span className="block sm:inline sm:ml-2">
                                      {detailedOrder.delivery_schedule.delivery_time_start} - {detailedOrder.delivery_schedule.delivery_time_end}
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">Scheduled Delivery</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Order Items */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="w-4 h-4" />
                        Order Items ({detailedOrder?.items?.length || order?.order_items?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(detailedOrder?.items || order?.order_items || []).length > 0 ? (
                        <div className="space-y-4">
                          {(detailedOrder?.items || order?.order_items || []).map((item: any, index: number) => {
                            // Transform item data for ProductDetailCard with defensive checks
                            const transformedItem = {
                              id: item.id || `item-${index}`,
                              product_id: item.product_id,
                              product_name: item.product_name || item.name || 'Unknown Product',
                              quantity: item.quantity || 1,
                              unit_price: item.unit_price || 0,
                              total_price: item.total_price || 0,
                              discount_amount: item.discount_amount || 0,
                              vat_amount: item.vat_amount || 0,
                              special_instructions: item.special_instructions,
                              customizations: item.customizations,
                              product: item.products || item.product || {
                                id: item.product_id || `product-${index}`,
                                name: item.product_name || item.name || 'Unknown Product',
                                description: item.description || 'Product details not available',
                                images: toImagesArray(item.products || item.product),
                                price: item.unit_price || 0,
                                is_available: item.products?.is_available ?? item.product?.is_available ?? true,
                                features: item.products?.features || item.product?.features || []
                              }
                            };

                            return (
                              <div key={transformedItem.id} className="border rounded-lg p-3 sm:p-4 bg-muted/20">
                                <ProductDetailCard 
                                  item={transformedItem}
                                  showReorderButton={false}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No items found for this order</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Order Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Payment Status:</span>
                          <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                            {order.payment_status?.toUpperCase() || 'PENDING'}
                          </Badge>
                        </div>
                        
                        {order.payment_method && (
                          <div className="flex justify-between text-sm">
                            <span>Payment Method:</span>
                            <span className="capitalize">{order.payment_method}</span>
                          </div>
                        )}
                        
                        {order.delivery_fee && order.delivery_fee > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Delivery Fee:</span>
                            <span>{formatCurrency(order.delivery_fee)}</span>
                          </div>
                        )}
                        
                        <Separator className="my-3" />
                        
                        <div className="flex justify-between font-semibold">
                          <span>Total Amount:</span>
                          <span>{formatCurrency(order.total_amount)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <OrderReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        order={order}
      />
    </>
  );
}