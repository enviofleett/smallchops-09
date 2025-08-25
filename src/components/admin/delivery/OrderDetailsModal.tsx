import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Package, User, MapPin, Clock, Phone, Mail, Printer, Loader2 } from 'lucide-react';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { ProductDetailCard } from '@/components/orders/ProductDetailCard';
import { OrderReceiptModal } from '@/components/customer/OrderReceiptModal';
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge';
import { useToast } from '@/hooks/use-toast';

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const [showPrintModal, setShowPrintModal] = useState(false);
  const { toast } = useToast();
  
  // Fetch detailed order data with product information
  const { data: detailedOrder, isLoading, error } = useDetailedOrderData(order?.id);
  const { data: businessSettings } = useBusinessSettings();

  const formatAddress = (address: any) => {
    if (!address) return 'No address provided';
    
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
    ].filter(Boolean);
    
    return parts.join(', ');
  };

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  // Use the detailed order data if available, fallback to the original order
  const displayOrder = detailedOrder?.order || order;
  const orderItems = detailedOrder?.items || order?.order_items || [];

  if (error) {
    toast({
      title: "Error loading order details",
      description: "Failed to load complete order information",
      variant: "destructive",
    });
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-6">
            {/* Branded Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {businessSettings?.logo_url && (
                  <img 
                    src={businessSettings.logo_url} 
                    alt={businessSettings.logo_alt_text || businessSettings.name || 'Logo'}
                    className="h-12 w-auto object-contain"
                  />
                )}
                <div>
                  <DialogTitle className="text-2xl font-bold">
                    {businessSettings?.name || 'Starters'} - Order Details
                  </DialogTitle>
                  <DialogDescription className="text-lg">
                    Order #{displayOrder.order_number}
                  </DialogDescription>
                </div>
              </div>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Order
              </Button>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-2 text-muted-foreground">Loading order details...</span>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Order Status and Type */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                <AdminOrderStatusBadge status={displayOrder.status} />
                <Badge 
                  variant={displayOrder.order_type === 'delivery' ? 'outline' : 'secondary'}
                  className="text-sm"
                >
                  {displayOrder.order_type?.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Placed on {format(new Date(displayOrder.created_at), 'MMM dd, yyyy HH:mm')}
                </span>
                {displayOrder.paid_at && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    PAID
                  </Badge>
                )}
              </div>

              {/* Customer Information */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2 text-primary">
                  <User className="w-5 h-5" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-semibold text-lg">{displayOrder.customer_name}</p>
                    <p className="text-muted-foreground flex items-center gap-2 mt-2">
                      <Mail className="w-4 h-4" />
                      {displayOrder.customer_email}
                    </p>  
                    {displayOrder.customer_phone && (
                      <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        <Phone className="w-4 h-4" />
                        {displayOrder.customer_phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Information */}
              {displayOrder.order_type === 'delivery' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2 text-primary">
                    <MapPin className="w-5 h-5" />
                    Delivery Information
                  </h3>
                  <div className="p-6 bg-muted/30 rounded-lg space-y-4">
                    <div>
                      <p className="font-semibold mb-2">Delivery Address:</p>
                      <p>{formatAddress(displayOrder.delivery_address)}</p>
                    </div>
                    
                    {detailedOrder?.delivery_schedule && (
                      <div>
                        <p className="font-semibold mb-2 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Delivery Window:
                        </p>
                        <p>
                          {format(new Date(detailedOrder.delivery_schedule.delivery_date), 'MMM dd, yyyy')} - {' '}
                          {detailedOrder.delivery_schedule.delivery_time_start} to {detailedOrder.delivery_schedule.delivery_time_end}
                        </p>
                        {detailedOrder.delivery_schedule.is_flexible && (
                          <p className="text-sm text-muted-foreground mt-1">
                            ✓ Flexible delivery time
                          </p>
                        )}
                      </div>
                    )}
                    
                    {detailedOrder?.delivery_schedule?.special_instructions && (
                      <div>
                        <p className="font-semibold mb-2">Special Instructions:</p>
                        <p className="bg-background p-3 rounded border">
                          {detailedOrder.delivery_schedule.special_instructions}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Order Items with Full Product Details */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2 text-primary">
                  <Package className="w-5 h-5" />
                  Order Items ({orderItems.length})
                </h3>
                <div className="space-y-3">
                  {orderItems.map((item: any, index: number) => (
                    <ProductDetailCard
                      key={item.id || index}
                      item={item}
                      showReorderButton={false}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Order Summary */}
              <div className="space-y-4 p-6 bg-muted/30 rounded-lg">
                <h3 className="text-xl font-semibold">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Subtotal:</span>
                    <span>₦{displayOrder.total_amount?.toLocaleString()}</span>
                  </div>
                  {displayOrder.delivery_fee > 0 && (
                    <div className="flex justify-between items-center">
                      <span>Delivery Fee:</span>
                      <span>₦{displayOrder.delivery_fee?.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between items-center text-xl font-bold">
                    <span>Total Amount:</span>
                    <span>₦{displayOrder.total_amount?.toLocaleString()}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-muted-foreground">
                    Payment Status: <span className="font-medium">{displayOrder.payment_status || 'Pending'}</span>
                  </p>
                  {displayOrder.payment_method && (
                    <p className="text-muted-foreground">
                      Payment Method: <span className="font-medium">{displayOrder.payment_method}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Modal */}
      {showPrintModal && (
        <OrderReceiptModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          order={displayOrder}
        />
      )}
    </>
  );
}