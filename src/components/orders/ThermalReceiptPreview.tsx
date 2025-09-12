import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OrderWithItems } from '@/api/orders';
import { Printer, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BusinessInfo {
  name: string;
  admin_notification_email?: string;
  whatsapp_support_number?: string;
  logo_url?: string;
}

interface ThermalReceiptPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  order: OrderWithItems | null;
  deliverySchedule?: any;
  businessInfo?: BusinessInfo | null;
  isPrinting?: boolean;
}

export const ThermalReceiptPreview: React.FC<ThermalReceiptPreviewProps> = ({
  isOpen,
  onClose,
  onPrint,
  order,
  deliverySchedule,
  businessInfo,
  isPrinting = false
}) => {
  const [pickupPoint, setPickupPoint] = useState<any>(null);
  
  // Fetch pickup point details if order is pickup type
  useEffect(() => {
    const fetchPickupPoint = async () => {
      if (order?.order_type === 'pickup' && order?.pickup_point_id) {
        try {
          const { data } = await supabase
            .from('pickup_points')
            .select('*')
            .eq('id', order.pickup_point_id)
            .single();
          setPickupPoint(data);
        } catch (error) {
          console.warn('Failed to fetch pickup point details:', error);
        }
      } else {
        setPickupPoint(null);
      }
    };
    
    if (isOpen && order) {
      fetchPickupPoint();
    }
  }, [isOpen, order]);

  if (!order) return null;

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  const getOrderTypeDisplay = () => {
    return order.order_type === 'delivery' ? 'Delivery' : 'Pickup';
  };

  const getDeliveryInfo = () => {
    if (order.order_type === 'delivery' && order.delivery_address) {
      const address = typeof order.delivery_address === 'string' 
        ? order.delivery_address 
        : (order.delivery_address as any)?.formatted_address || 'Address on file';
      
      const instructions = typeof order.delivery_address === 'object'
        ? (order.delivery_address as any)?.instructions
        : null;

      return { address, instructions };
    }
    return null;
  };

  const getItemDetails = (item: any) => {
    const product = item.products || {};
    const details = [];
    
    if (product.description) {
      details.push(`Desc: ${product.description}`);
    }
    
    if (product.ingredients && Array.isArray(product.ingredients)) {
      details.push(`Ingredients: ${product.ingredients.join(', ')}`);
    }
    
    if (product.features && Array.isArray(product.features)) {
      details.push(`Features: ${product.features.join(', ')}`);
    }
    
    return details;
  };

  const deliveryInfo = getDeliveryInfo();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Thermal Receipt Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="max-h-[500px] overflow-y-auto">
          {/* Receipt Preview */}
          <div className="bg-white text-black font-mono text-xs leading-tight p-4 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="w-full max-w-[280px] mx-auto">
              {/* Business Header */}
              <div className="text-center mb-2">
                <div className="font-bold text-sm uppercase">
                  {businessInfo?.name || 'STARTERS SMALL CHOPS'}
                </div>
                {businessInfo?.whatsapp_support_number && (
                  <div className="text-xs">
                    Contact: {businessInfo.whatsapp_support_number}
                  </div>
                )}
              </div>
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Order Info */}
              <div className="mb-2">
                <div>ORDER #: {order.order_number}</div>
                <div>Date: {new Date(order.created_at).toLocaleString('en-GB', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</div>
                <div>Type: {getOrderTypeDisplay()}</div>
                <div>Status: {order.status?.replace('_', ' ').toUpperCase()}</div>
              </div>
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Customer Info */}
              <div className="mb-2">
                <div className="font-bold">CUSTOMER INFO:</div>
                <div>Name: {order.customer_name}</div>
                {order.customer_phone && <div>Phone: {order.customer_phone}</div>}
                {order.customer_email && <div>Email: {order.customer_email}</div>}
              </div>
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Delivery/Pickup Schedule */}
              <div className="mb-2">
                <div className="font-bold">{getOrderTypeDisplay().toUpperCase()} SCHEDULE:</div>
                
                {order.order_type === 'delivery' && (
                  <>
                    {deliverySchedule && (
                      <>
                        <div>Date: {new Date(deliverySchedule.delivery_date).toLocaleDateString('en-GB')}</div>
                        <div>Time: {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</div>
                        {deliverySchedule.special_instructions && (
                          <div>Special Notes: {deliverySchedule.special_instructions}</div>
                        )}
                      </>
                    )}
                    {deliveryInfo?.address && <div>Address: {deliveryInfo.address}</div>}
                    {deliveryInfo?.instructions && <div>Instructions: {deliveryInfo.instructions}</div>}
                  </>
                )}
                
                {order.order_type === 'pickup' && (
                  <>
                    {deliverySchedule && (
                      <>
                        <div>Date: {new Date(deliverySchedule.delivery_date).toLocaleDateString('en-GB')}</div>
                        <div>Time: {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</div>
                        {deliverySchedule.special_instructions && (
                          <div>Special Notes: {deliverySchedule.special_instructions}</div>
                        )}
                      </>
                    )}
                    {pickupPoint && (
                      <>
                        <div>Location: {pickupPoint.name}</div>
                        <div>Address: {pickupPoint.address}</div>
                        {pickupPoint.contact_phone && (
                          <div>Contact: {pickupPoint.contact_phone}</div>
                        )}
                        {pickupPoint.operating_hours && (
                          <div>Hours: {JSON.stringify(pickupPoint.operating_hours).replace(/[{}\"]/g, '').replace(/,/g, ', ')}</div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Order Items */}
              <div className="mb-2">
                <div className="font-bold">ORDER ITEMS & DETAILS:</div>
                <div className="text-center text-xs my-1">
                  --------------------------------
                </div>
                
                {order.order_items?.map((item, index) => {
                  const itemDetails = getItemDetails(item);
                  return (
                    <div key={index} className="mb-1">
                      <div className="flex justify-between items-start">
                        <span className="flex-1 pr-2">{item.product_name}</span>
                        <span className="font-bold">{formatCurrency(item.total_price || 0)}</span>
                      </div>
                      <div className="text-xs">
                        <span>Qty: {item.quantity}</span>
                        {item.unit_price && (
                          <span> @ {formatCurrency(item.unit_price)}</span>
                        )}
                      </div>
                      
                      {itemDetails.map((detail, detailIndex) => (
                        <div key={detailIndex} className="text-xs ml-1">
                          {detail}
                        </div>
                      ))}
                      
                      {index < order.order_items.length - 1 && (
                        <div className="h-1"></div>
                      )}
                    </div>
                  );
                })}
                
                <div className="text-center text-xs my-1">
                  --------------------------------
                </div>
              </div>
              
              {/* Order Summary */}
              <div className="mb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(order.subtotal || 0)}</span>
                </div>
                {order.delivery_fee && order.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span>{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                {order.total_vat && order.total_vat > 0 && (
                  <div className="flex justify-between">
                    <span>VAT ({((order.total_vat / (order.subtotal || 1)) * 100).toFixed(1)}%):</span>
                    <span>{formatCurrency(order.total_vat)}</span>
                  </div>
                )}
                {order.discount_amount && order.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Payment Info */}
              <div className="mb-2">
                <div className="font-bold">PAYMENT DETAILS:</div>
                <div>Method: {order.payment_method || 'N/A'}</div>
                <div>Status: {order.payment_status?.replace('_', ' ').toUpperCase()}</div>
                {order.payment_reference && <div>Ref: {order.payment_reference}</div>}
              </div>
              
              {order.special_instructions && (
                <>
                  <div className="text-center text-xs my-1">
                    ================================
                  </div>
                  <div className="mb-2">
                    <div className="font-bold">PREPARATION NOTES:</div>
                    <div className="text-xs">{order.special_instructions}</div>
                  </div>
                </>
              )}
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Footer */}
              <div className="text-center text-xs">
                <div>Thank you for your order!</div>
                <div className="font-bold">Starters Small Chops</div>
                {businessInfo?.admin_notification_email && (
                  <div>{businessInfo.admin_notification_email}</div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex justify-between gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onPrint} disabled={isPrinting}>
            {isPrinting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            {isPrinting ? 'Printing...' : 'Print to Thermal Printer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};