import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OrderWithItems } from '@/api/orders';
import { Printer, X, Loader2 } from 'lucide-react';

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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Thermal Receipt Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
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
                {deliverySchedule && (
                  <>
                    <div>Date: {new Date(deliverySchedule.delivery_date).toLocaleDateString('en-GB')}</div>
                    <div>Time: {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</div>
                    {deliveryInfo?.address && <div>Address: {deliveryInfo.address}</div>}
                    {deliveryInfo?.instructions && <div>Instructions: {deliveryInfo.instructions}</div>}
                    {deliverySchedule.special_instructions && (
                      <div>Special Notes: {deliverySchedule.special_instructions}</div>
                    )}
                  </>
                )}
                {!deliverySchedule && order.order_type === 'delivery' && deliveryInfo?.address && (
                  <div>Address: {deliveryInfo.address}</div>
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
                    <div key={index} className="mb-2">
                      <div className="flex justify-between font-bold">
                        <span>{item.product_name}</span>
                        <span>{formatCurrency(item.total_price || 0)}</span>
                      </div>
                      <div className="text-xs">
                        Qty: {item.quantity}
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
                
                <div className="text-center text-xs my-1">
                  --------------------------------
                </div>
                
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Payment Info */}
              <div className="mb-2">
                <div>Payment: {order.payment_status?.toUpperCase()}</div>
                {order.payment_method && <div>Method: {order.payment_method}</div>}
                {order.payment_reference && <div>Ref: {order.payment_reference}</div>}
              </div>
              
              <div className="text-center text-xs my-1">
                ================================
              </div>
              
              {/* Preparation Notes */}
              {(order.admin_notes || deliverySchedule?.special_instructions || deliveryInfo?.instructions) && (
                <>
                  <div className="mb-2">
                    <div className="font-bold">PREPARATION NOTES:</div>
                    {order.admin_notes && <div>- {order.admin_notes}</div>}
                    {deliverySchedule?.special_instructions && (
                      <div>- {deliverySchedule.special_instructions}</div>
                    )}
                    {deliveryInfo?.instructions && (
                      <div>- Delivery: {deliveryInfo.instructions}</div>
                    )}
                  </div>
                  <div className="text-center text-xs my-1">
                    ================================
                  </div>
                </>
              )}
              
              {/* Footer */}
              <div className="text-center mb-2">
                <div>Thank you for your order!</div>
                <div>Estimated prep time: 25-30 mins</div>
                {businessInfo?.whatsapp_support_number && (
                  <div>For support: {businessInfo.whatsapp_support_number}</div>
                )}
                {businessInfo?.admin_notification_email && (
                  <div>Email: {businessInfo.admin_notification_email}</div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPrinting}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={onPrint}
            disabled={isPrinting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPrinting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                Print to Thermal Printer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};