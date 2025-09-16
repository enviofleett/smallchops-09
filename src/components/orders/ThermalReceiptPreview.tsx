import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OrderWithItems } from '@/api/orders';
import { Printer, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateReceiptContent } from '@/utils/receiptGenerator';

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

  // Generate receipt content using shared utility
  const receiptContent = generateReceiptContent({
    order,
    deliverySchedule,
    businessInfo,
    pickupPoint
  });

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
                  {receiptContent.businessName}
                </div>
                {receiptContent.contactNumber && (
                  <div className="text-xs">
                    Contact: {receiptContent.contactNumber}
                  </div>
                )}
              </div>
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Order Info */}
              <div className="mb-2">
                <div>ORDER #: {order.order_number}</div>
                <div>Date: {receiptContent.formattedDate}</div>
                <div>Type: {receiptContent.getOrderTypeDisplay()}</div>
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
                <div className="font-bold">{receiptContent.getOrderTypeDisplay().toUpperCase()} SCHEDULE:</div>
                
                {order.order_type === 'delivery' && (
                  <>
                    {deliverySchedule && (
                      <>
                        <div>Scheduled Date: {receiptContent.formattedScheduleDate}</div>
                        <div>Time Window: {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</div>
                        {deliverySchedule.is_flexible && (
                          <div>Flexible: Yes</div>
                        )}
                        {deliverySchedule.special_instructions && (
                          <div>Special Notes: {deliverySchedule.special_instructions}</div>
                        )}
                      </>
                    )}
                    {receiptContent.deliveryInfo?.address && (
                      <div>Delivery Address: {receiptContent.deliveryInfo.address}</div>
                    )}
                    {receiptContent.deliveryInfo?.instructions && (
                      <div>Delivery Instructions: {receiptContent.deliveryInfo.instructions}</div>
                    )}
                    {!deliverySchedule && receiptContent.deliveryInfo?.address && (
                      <div>⚠️ No scheduled delivery window</div>
                    )}
                  </>
                )}
                
                {order.order_type === 'pickup' && (
                  <>
                    {deliverySchedule && (
                      <>
                        <div>Scheduled Date: {receiptContent.formattedScheduleDate}</div>
                        <div>Pickup Window: {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</div>
                        {deliverySchedule.is_flexible && (
                          <div>Flexible: Yes</div>
                        )}
                        {deliverySchedule.special_instructions && (
                          <div>Special Notes: {deliverySchedule.special_instructions}</div>
                        )}
                      </>
                    )}
                    {pickupPoint && (
                      <>
                        <div>Pickup Location: {pickupPoint.name}</div>
                        <div>Location Address: {pickupPoint.address}</div>
                        {pickupPoint.contact_phone && (
                          <div>Location Phone: {pickupPoint.contact_phone}</div>
                        )}
                        {receiptContent.pickupPointHours && (
                          <div>Operating Hours: {receiptContent.pickupPointHours}</div>
                        )}
                      </>
                    )}
                    {!deliverySchedule && !pickupPoint && (
                      <div>⚠️ No pickup schedule or location</div>
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
                  const itemDetails = receiptContent.getItemDetails(item);
                  return (
                    <div key={index} className="mb-1">
                      <div className="flex justify-between items-start">
                        <span className="flex-1 pr-2">{item.product_name}</span>
                        <span className="font-bold">{receiptContent.formatCurrency(item.total_price || 0)}</span>
                      </div>
                      <div className="text-xs">
                        <span>Qty: {item.quantity}</span>
                        {item.unit_price && (
                          <span> @ {receiptContent.formatCurrency(item.unit_price)}</span>
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
                  <span>{receiptContent.formatCurrency(order.subtotal || 0)}</span>
                </div>
                {order.delivery_fee && order.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span>{receiptContent.formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                {order.total_vat && order.total_vat > 0 && (
                  <div className="flex justify-between">
                    <span>VAT ({((order.total_vat / (order.subtotal || 1)) * 100).toFixed(1)}%):</span>
                    <span>{receiptContent.formatCurrency(order.total_vat)}</span>
                  </div>
                )}
                {order.discount_amount && order.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-{receiptContent.formatCurrency(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>TOTAL:</span>
                  <span>{receiptContent.formatCurrency(order.total_amount)}</span>
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
                {receiptContent.adminEmail && (
                  <div>{receiptContent.adminEmail}</div>
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