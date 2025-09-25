import React from 'react';
import { User, Phone, MapPin, Package, Calendar, Clock, Shield, Truck, ShoppingCart, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from './SectionHeading';
import { formatAddressMultiline } from '@/utils/formatAddress';
import { getDeliveryInstructionsFromAddress } from '@/utils/deliveryInstructions';
import { format } from 'date-fns';
import { getFirstImage } from '@/lib/imageUtils';

interface CustomerInfoCardProps {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  orderType: 'delivery' | 'pickup';
  deliveryAddress?: any;
  pickupPoint?: {
    name: string;
    address: string;
    contact_phone?: string;
  };
  order?: {
    status: string;
    payment_status: string;
    order_time: string;
    order_number: string;
    payment_method?: string;
    payment_reference?: string;
    paystack_reference?: string;
  };
  deliverySchedule?: {
    scheduled_date?: string;
    delivery_date?: string;
    delivery_time_start?: string;
    delivery_time_end?: string;
    special_instructions?: string;
    is_flexible?: boolean;
    requested_at?: string;
  };
  items?: any[];
  subtotal?: number;
  totalVat?: number;
  totalDiscount?: number;
  deliveryFee?: number;
  grandTotal?: number;
}

export const CustomerInfoCard: React.FC<CustomerInfoCardProps> = ({
  customerName,
  customerPhone,
  customerEmail,
  orderType,
  deliveryAddress,
  pickupPoint,
  order,
  deliverySchedule,
  items = [],
  subtotal = 0,
  totalVat = 0,
  totalDiscount = 0,
  deliveryFee = 0,
  grandTotal = 0
}) => {
  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  const getDeliveryInfo = () => {
    if (orderType === 'pickup' && pickupPoint) {
      return {
        type: 'Pickup',
        address: pickupPoint.address || 'Pickup Point',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled'
      };
    } else if (orderType === 'delivery') {
      const formattedAddress = deliveryAddress ? formatAddressMultiline(deliveryAddress) : 'Not provided';
      return {
        type: 'Delivery',
        address: formattedAddress,
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled'
      };
    }
    return { type: 'Unknown', address: 'Not provided', time: 'Not scheduled' };
  };

  const formatTimeWindow = () => {
    if (!deliverySchedule?.scheduled_date) return '4:00 PM – 5:00 PM';
    
    const startTime = deliverySchedule.delivery_time_start ? 
      deliverySchedule.delivery_time_start : 
      format(new Date(deliverySchedule.scheduled_date), 'p');
    
    const endTime = deliverySchedule.delivery_time_end ? 
      deliverySchedule.delivery_time_end : 
      format(new Date(new Date(deliverySchedule.scheduled_date).getTime() + 60*60*1000), 'p');
    
    return `${startTime} – ${endTime}`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
      case 'delivered':
      case 'completed':
        return 'default';
      case 'pending':
      case 'confirmed':
        return 'secondary';
      case 'cancelled':
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const deliveryInfo = getDeliveryInfo();
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <SectionHeading 
          title="Customer Information" 
          icon={User} 
        />
        
        <div className="space-y-6">
          {/* Customer Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium break-words">{customerName}</span>
            </div>
            
            {customerPhone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm break-words">{customerPhone}</span>
              </div>
            )}
            
            {customerEmail && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm break-words">{customerEmail}</span>
              </div>
            )}
          </div>

          {/* Order Status Information */}
          {order && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Order Status
                </span>
              </div>
              <div className="ml-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {order.status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment:</span>
                  <Badge variant={getStatusBadgeVariant(order.payment_status)}>
                    {order.payment_status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Fulfillment Information */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {deliveryInfo.type} Information
              </span>
            </div>
            <div className="ml-6 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  {deliveryInfo.address.split('\n').map((line, index) => (
                    <div key={index} className="text-sm text-foreground">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">{deliveryInfo.time}</span>
              </div>
            </div>
          </div>

          {/* Schedule Fulfillment (for pickup orders) */}
          {orderType === 'pickup' && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pickup Schedule Fulfillment
                </span>
              </div>
              <div className="ml-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Channel:</span>
                  <Badge variant="outline">Pickup</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span className="text-sm text-foreground">
                    {deliverySchedule?.scheduled_date ? 
                      format(new Date(deliverySchedule.scheduled_date), 'PPP') : 
                      'Today'
                    }
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time Window:</span>
                  <div className="text-right">
                    <div className="text-sm text-foreground">{formatTimeWindow()}</div>
                    <div className="text-xs text-muted-foreground">⏰ Upcoming window</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Business Day:</span>
                  <span className="text-sm text-foreground">
                    {deliverySchedule?.scheduled_date ? 
                      format(new Date(deliverySchedule.scheduled_date), 'EEEE') : 
                      format(new Date(), 'EEEE')
                    }
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Schedule Fulfillment (for delivery orders) */}
          {orderType === 'delivery' && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Delivery Schedule Fulfillment
                </span>
              </div>
              <div className="ml-6 space-y-2">
                {/* Comprehensive Checkout Information */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Channel:</span>
                  <Badge variant="outline">Delivery</Badge>
                </div>
                
                {/* Customer's Preferred Delivery Date */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Customer Selected Date:</span>
                  <span className="text-sm text-foreground font-medium">
                    {(() => {
                      const customerSelectedDate = deliverySchedule?.delivery_date || deliverySchedule?.scheduled_date;
                      
                      if (customerSelectedDate) {
                        try {
                          return format(new Date(customerSelectedDate), 'EEEE, MMMM d, yyyy');
                        } catch (error) {
                          console.error('Error formatting customer selected date:', error);
                          return customerSelectedDate;
                        }
                      }
                      
                      return 'Not selected during checkout';
                    })()}
                  </span>
                </div>
                
                {/* Customer's Preferred Time Window */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Preferred Time Window:</span>
                  <div className="text-right">
                    <div className="text-sm text-foreground">{formatTimeWindow()}</div>
                    <div className="text-xs text-muted-foreground">
                      {deliverySchedule?.is_flexible ? '🔄 Customer chose flexible timing' : '⏰ Customer chose fixed window'}
                    </div>
                  </div>
                </div>
                
                {/* Complete Delivery Address from Checkout */}
                {deliveryAddress && (
                  <div className="pt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wider block">
                          Complete Checkout Address Details
                        </span>
                        
                        {/* Primary Address Lines */}
                        {deliveryAddress.address?.address_line_1 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Address Line 1:</span>
                            <span className="text-sm text-foreground font-medium">
                              {deliveryAddress.address.address_line_1}
                            </span>
                          </div>
                        )}
                        
                        {deliveryAddress.address?.address_line_2 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Address Line 2:</span>
                            <span className="text-sm text-foreground">
                              {deliveryAddress.address.address_line_2}
                            </span>
                          </div>
                        )}
                        
                        {/* City and State */}
                        {deliveryAddress.address?.city && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">City:</span>
                            <span className="text-sm text-foreground font-medium">
                              {deliveryAddress.address.city}
                            </span>
                          </div>
                        )}
                        
                        {deliveryAddress.address?.state && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">State:</span>
                            <span className="text-sm text-foreground">
                              {deliveryAddress.address.state}
                            </span>
                          </div>
                        )}
                        
                        {/* Postal Code */}
                        {deliveryAddress.address?.postal_code && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Postal Code:</span>
                            <span className="text-sm text-foreground">
                              {deliveryAddress.address.postal_code}
                            </span>
                          </div>
                        )}
                        
                        {/* Landmark for Navigation */}
                        {deliveryAddress.address?.landmark && (
                          <div className="flex items-start justify-between">
                            <span className="text-xs text-muted-foreground">Landmark:</span>
                            <span className="text-sm text-foreground text-right max-w-[60%]">
                              {deliveryAddress.address.landmark}
                            </span>
                          </div>
                        )}
                        
                        {/* Delivery Zone Information */}
                        {deliveryAddress.zone_id && (
                          <div className="pt-2 border-t border-border/30">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Delivery Zone ID:</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {deliveryAddress.zone_id}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Location Coordinates (if available) */}
                        {deliveryAddress.location && deliveryAddress.location !== "" && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">GPS Coordinates:</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {deliveryAddress.location}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Special Instructions from Checkout */}
                {deliverySchedule?.special_instructions && (
                  <div className="pt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 flex-1">
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">
                          Customer Delivery Instructions
                        </span>
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                          <span className="text-sm text-amber-800 italic">
                            "{deliverySchedule.special_instructions}"
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Order Timing Details */}
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Order Timing Information
                  </span>
                  
                  {order?.order_time && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Order Placed:</span>
                      <span className="text-sm text-foreground">
                        {format(new Date(order.order_time), 'PPP p')}
                      </span>
                    </div>
                  )}
                  
                  {deliverySchedule?.requested_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Delivery Requested:</span>
                      <span className="text-sm text-foreground">
                        {format(new Date(deliverySchedule.requested_at), 'PPP p')}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Business Day:</span>
                    <span className="text-sm text-foreground">
                      {(() => {
                        const customerSelectedDate = deliverySchedule?.delivery_date || deliverySchedule?.scheduled_date;
                        
                        if (customerSelectedDate) {
                          try {
                            return format(new Date(customerSelectedDate), 'EEEE');
                          } catch (error) {
                            return format(new Date(), 'EEEE');
                          }
                        }
                        
                        return format(new Date(), 'EEEE');
                      })()}
                    </span>
                  </div>
                </div>
                
                {/* Payment Information from Checkout */}
                {order && (
                  <div className="pt-3 border-t border-border/50 space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Payment Details from Checkout
                    </span>
                    
                    {order.payment_method && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Payment Method:</span>
                        <Badge variant="outline" className="text-xs">
                          {order.payment_method.toUpperCase()}
                        </Badge>
                      </div>
                    )}
                    
                    {order.payment_reference && (
                      <div className="flex items-start justify-between">
                        <span className="text-xs text-muted-foreground">Payment Reference:</span>
                        <span className="text-xs text-foreground font-mono text-right max-w-[60%] break-all">
                          {order.payment_reference}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Payment Status:</span>
                      <Badge variant={getStatusBadgeVariant(order.payment_status)} className="text-xs">
                        {order.payment_status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Channel:</span>
                  <Badge variant="outline">Delivery</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Delivery Date:</span>
                  <span className="text-sm text-foreground">
                    {(() => {
                      // Prioritize customer-selected delivery date from checkout
                      const customerSelectedDate = deliverySchedule?.delivery_date || deliverySchedule?.scheduled_date;
                      
                      if (customerSelectedDate) {
                        try {
                          return format(new Date(customerSelectedDate), 'EEEE, MMMM d, yyyy');
                        } catch (error) {
                          console.error('Error formatting delivery date:', error);
                          return customerSelectedDate; // Fallback to raw date string
                        }
                      }
                      
                      return 'To be scheduled';
                    })()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time Window:</span>
                  <div className="text-right">
                    <div className="text-sm text-foreground">{formatTimeWindow()}</div>
                    <div className="text-xs text-muted-foreground">
                      {deliverySchedule?.is_flexible ? '🔄 Flexible timing' : '⏰ Fixed window'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Customer Selected Date:</span>
                  <span className="text-sm text-foreground font-medium">
                    {(() => {
                      // Show the exact date chosen by customer during checkout
                      const customerSelectedDate = deliverySchedule?.delivery_date || deliverySchedule?.scheduled_date;
                      
                      if (customerSelectedDate) {
                        try {
                          return format(new Date(customerSelectedDate), 'EEEE, MMMM d, yyyy');
                        } catch (error) {
                          console.error('Error formatting customer selected date:', error);
                          return customerSelectedDate; // Fallback to raw date string
                        }
                      }
                      
                      return 'Not selected yet';
                    })()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Business Day:</span>
                  <span className="text-sm text-foreground">
                    {(() => {
                      const customerSelectedDate = deliverySchedule?.delivery_date || deliverySchedule?.scheduled_date;
                      
                      if (customerSelectedDate) {
                        try {
                          return format(new Date(customerSelectedDate), 'EEEE');
                        } catch (error) {
                          console.error('Error formatting delivery day:', error);
                          return format(new Date(), 'EEEE');
                        }
                      }
                      
                      return format(new Date(), 'EEEE');
                    })()}
                  </span>
                </div>

                {deliverySchedule?.requested_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Requested:</span>
                    <span className="text-sm text-foreground">
                      {(() => {
                        try {
                          return format(new Date(deliverySchedule.requested_at), 'PPP p');
                        } catch (error) {
                          console.error('Error formatting requested date:', error);
                          return deliverySchedule.requested_at;
                        }
                      })()}
                    </span>
                  </div>
                )}
                
                {/* Customer's Delivery Address */}
                {deliveryAddress && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 flex-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                          Customer Delivery Address
                        </span>
                        <div className="space-y-0.5">
                          {(() => {
                            try {
                              const formattedAddress = formatAddressMultiline(deliveryAddress);
                              return formattedAddress.split('\n').map((line, index) => (
                                <div key={index} className="text-sm text-foreground">
                                  {line}
                                </div>
                              ));
                            } catch (error) {
                              console.error('Error formatting delivery address:', error);
                              return (
                                <div className="text-sm text-muted-foreground italic">
                                  Address formatting error - {typeof deliveryAddress === 'string' ? deliveryAddress : 'Invalid address data'}
                                </div>
                              );
                            }
                          })()}
                        </div>
                        
                        {/* Delivery Instructions from Address */}
                        {(() => {
                          try {
                            const instructions = getDeliveryInstructionsFromAddress(deliveryAddress);
                            if (instructions && instructions.trim()) {
                              return (
                                <div className="mt-2 p-2 bg-muted/50 rounded-md">
                                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                                    Delivery Notes
                                  </span>
                                  <span className="text-sm text-foreground italic">
                                    "{instructions}"
                                  </span>
                                </div>
                              );
                            }
                          } catch (error) {
                            console.error('Error extracting delivery instructions:', error);
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Items */}
          {items && items.length > 0 && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Order Items ({items.length})
                </span>
              </div>
              <div className="ml-6 space-y-3">
                {items.slice(0, 3).map((item, index) => (
                  <div key={item.id || index} className="flex items-start gap-3 p-3 bg-card/50 rounded-lg border border-border/50">
                    {item.product?.image_url ? (
                      <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-primary/20">
                        <img 
                          src={getFirstImage(item.product)} 
                          alt={item.product_name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            (target.nextElementSibling as HTMLElement)?.classList.remove('hidden');
                          }}
                        />
                        <div className="hidden w-full h-full bg-primary/10 rounded-md flex items-center justify-center">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium text-foreground truncate">{item.product_name}</h5>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Qty:</span>
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                            {Number(item.quantity ?? 0)}
                          </span>
                        </span>
                        <span className="text-foreground font-medium">
                          {formatCurrency(Number(item.total_price ?? 0))}
                        </span>
                      </div>
                      {item.special_instructions && (
                        <div className="mt-2 p-2 bg-orange-50/50 border border-orange-200/50 rounded text-xs">
                          <span className="text-orange-600 font-medium">Note:</span>
                          <span className="text-orange-700 ml-1 italic">{item.special_instructions}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-center py-2">
                    <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                      +{items.length - 3} more items
                    </span>
                  </div>
                )}
                {grandTotal > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Order Total:</span>
                      <span className="text-base font-bold text-primary">{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {(deliverySchedule?.special_instructions || (orderType === 'delivery' && getDeliveryInstructionsFromAddress(deliveryAddress))) && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {orderType === 'delivery' ? 'Delivery Instructions' : 'Special Instructions'}
                </span>
              </div>
              <div className="ml-6 space-y-3">
                {deliverySchedule?.special_instructions && (
                  <div className="bg-orange-50/80 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200/50 dark:border-orange-800/50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 dark:text-orange-400 text-sm">📝</span>
                      </div>
                      <div className="flex-1">
                        <h5 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2">Customer Instructions:</h5>
                        <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed whitespace-pre-wrap break-words">
                          {deliverySchedule.special_instructions}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {orderType === 'delivery' && getDeliveryInstructionsFromAddress(deliveryAddress) && (
                  <div className="bg-blue-50/80 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Delivery Address Notes:</h5>
                        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-wrap break-words">
                          {getDeliveryInstructionsFromAddress(deliveryAddress)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};