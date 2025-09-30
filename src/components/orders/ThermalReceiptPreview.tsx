import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, FileText } from 'lucide-react';
import { OrderWithItems } from '@/api/orders';
import { generateReceiptContent } from '@/utils/receiptGenerator';

interface BusinessInfo {
  name: string;
  admin_notification_email?: string;
  whatsapp_support_number?: string;
  logo_url?: string;
  printed_by?: string;
  printed_on?: string;
  printer_type?: string;
  print_quality?: string;
}

interface ThermalReceiptPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  order: OrderWithItems | null;
  deliverySchedule?: any;
  businessInfo?: BusinessInfo | null;
}

export const ThermalReceiptPreview: React.FC<ThermalReceiptPreviewProps> = ({
  isOpen,
  onClose,
  onPrint,
  order,
  deliverySchedule,
  businessInfo
}) => {
  if (!order) return null;

  // Generate receipt content
  const receiptContent = generateReceiptContent({
    order,
    deliverySchedule,
    businessInfo,
    pickupPoint: (order as any).pickup_point
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            80mm Thermal Receipt Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Preview Info */}
          <div className="bg-blue-50 p-3 rounded-md border">
            <p className="text-sm text-blue-800">
              <strong>📄 Preview Mode:</strong> This shows exactly how your receipt will look when printed on 80mm thermal paper.
            </p>
          </div>
          
          {/* Receipt Preview Container - Simulates 80mm paper width */}
          <div className="bg-white border-2 border-gray-300 rounded-md p-4 shadow-lg" style={{ width: '302px', maxWidth: '100%' }}>
            <div className="thermal-receipt-preview" style={{ fontFamily: 'Consolas, Monaco, Courier New, monospace, sans-serif', fontSize: '11px', lineHeight: '1.3', color: 'black' }}>
              
              {/* Business Header */}
              <div className="text-center mb-2">
                <div style={{ fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', marginBottom: '3px', letterSpacing: '1px' }}>
                  {receiptContent.businessName}
                </div>
                {receiptContent.contactNumber && (
                  <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                    📞 {receiptContent.contactNumber}
                  </div>
                )}
              </div>
              
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '2px 0' }}>
                - - - - - - - - - - - - - - - - - -
              </div>
              
              {/* Order Info */}
              <div style={{ marginBottom: '3px', fontSize: '11px', fontWeight: 'bold' }}>
                <div><strong>ORDER #:</strong> {order.order_number}</div>
                <div><strong>Date:</strong> {receiptContent.formattedDate}</div>
                <div><strong>Type:</strong> {receiptContent.getOrderTypeDisplay().toUpperCase()}</div>
                <div><strong>Status:</strong> {order.status?.replace('_', ' ').toUpperCase()}</div>
              </div>
              
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '2px 0' }}>
                - - - - - - - - - - - - - - - - - -
              </div>
              
              {/* Customer Info */}
              <div style={{ marginBottom: '3px', fontSize: '11px', fontWeight: 'bold' }}>
                <div style={{ fontSize: '12px', fontWeight: '900', marginBottom: '2px', textTransform: 'uppercase' }}>
                  👤 CUSTOMER INFO:
                </div>
                <div><strong>Name:</strong> {order.customer_name}</div>
                {order.customer_phone && <div><strong>Phone:</strong> {order.customer_phone}</div>}
                {order.customer_email && <div><strong>Email:</strong> {order.customer_email}</div>}
              </div>
              
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '2px 0' }}>
                - - - - - - - - - - - - - - - - - -
              </div>
              
              {/* Schedule Info */}
              {(deliverySchedule || receiptContent.deliveryInfo?.address) && (
                <>
                  <div style={{ marginBottom: '3px', fontSize: '11px', fontWeight: 'bold' }}>
                    <div style={{ fontSize: '12px', fontWeight: '900', marginBottom: '2px', textTransform: 'uppercase' }}>
                      {receiptContent.getOrderTypeDisplay().toUpperCase()} SCHEDULE:
                    </div>
                    
                    {order.order_type === 'delivery' && (
                      <>
                        {deliverySchedule && (
                          <>
                            <div><strong>📅 Scheduled Date:</strong> {receiptContent.formattedScheduleDate}</div>
                            <div><strong>⏰ Time Window:</strong> {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</div>
                            {deliverySchedule.is_flexible ? (
                              <div><strong>🔄 Flexible:</strong> YES</div>
                            ) : (
                              <div><strong>⏰ Fixed Window:</strong> YES</div>
                            )}
                          </>
                        )}
                        {receiptContent.deliveryInfo?.address && (
                          <div><strong>📍 Delivery Address:</strong><br />{receiptContent.deliveryInfo.address}</div>
                        )}
                      </>
                    )}
                    
                    {order.order_type === 'pickup' && (
                      <>
                        {deliverySchedule && (
                          <>
                            <div><strong>📅 Scheduled Date:</strong> {receiptContent.formattedScheduleDate}</div>
                            <div><strong>⏰ Pickup Window:</strong> {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}</div>
                            {deliverySchedule.is_flexible ? (
                              <div><strong>🔄 Flexible:</strong> YES</div>
                            ) : (
                              <div><strong>⏰ Fixed Window:</strong> YES</div>
                            )}
                          </>
                        )}
                        {(order as any).pickup_point && (
                          <>
                            <div><strong>🏪 Pickup Location:</strong> {(order as any).pickup_point.name}</div>
                            <div><strong>📍 Address:</strong> {(order as any).pickup_point.address}</div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '2px 0' }}>
                    - - - - - - - - - - - - - - - - - -
                  </div>
                </>
              )}
              
              {/* Order Items */}
              <div style={{ marginBottom: '3px' }}>
                <div style={{ fontSize: '12px', fontWeight: '900', marginBottom: '2px', textTransform: 'uppercase' }}>
                  🛒 ORDER ITEMS:
                </div>
                <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '1px 0' }}>
                  - - - - - - - - - - - - - - - -
                </div>
                
                {order.order_items?.map((item, index) => (
                  <div key={index} style={{ marginBottom: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                      <span><strong>{item.product_name}</strong></span>
                      <span><strong>{receiptContent.formatCurrency(item.total_price || 0)}</strong></span>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 'bold' }}>
                      <strong>Qty:</strong> {item.quantity}{item.unit_price && ` @ ${receiptContent.formatCurrency(item.unit_price)}`}
                    </div>
                    {index < order.order_items.length - 1 && (
                      <div style={{ height: '2px' }}></div>
                    )}
                  </div>
                ))}
                
                <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '1px 0' }}>
                  - - - - - - - - - - - - - - - -
                </div>
              </div>
              
              {/* Order Summary */}
              <div style={{ marginBottom: '3px' }}>
                <div style={{ fontSize: '12px', fontWeight: '900', marginBottom: '2px', textTransform: 'uppercase' }}>
                  💰 ORDER SUMMARY:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '1px' }}>
                  <span><strong>Subtotal:</strong></span>
                  <span><strong>{receiptContent.formatCurrency(order.subtotal || 0)}</strong></span>
                </div>
                {order.delivery_fee && order.delivery_fee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '1px' }}>
                    <span><strong>🚚 Delivery Fee:</strong></span>
                    <span><strong>{receiptContent.formatCurrency(order.delivery_fee)}</strong></span>
                  </div>
                )}
                {order.total_vat && order.total_vat > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '1px' }}>
                    <span><strong>📊 VAT:</strong></span>
                    <span><strong>{receiptContent.formatCurrency(order.total_vat)}</strong></span>
                  </div>
                )}
                {order.discount_amount && order.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '1px', color: '#008000' }}>
                    <span><strong>💸 Discount:</strong></span>
                    <span><strong>-{receiptContent.formatCurrency(order.discount_amount)}</strong></span>
                  </div>
                )}
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontWeight: '900', 
                  fontSize: '13px', 
                  borderTop: '3px solid black',
                  borderBottom: '1px solid black',
                  padding: '3px 0',
                  margin: '3px 0',
                  backgroundColor: '#f0f0f0'
                }}>
                  <span><strong>💳 TOTAL:</strong></span>
                  <span><strong>{receiptContent.formatCurrency(order.total_amount)}</strong></span>
                </div>
              </div>
              
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '2px 0' }}>
                - - - - - - - - - - - - - - - - - -
              </div>
              
              {/* Payment Info */}
              <div style={{ marginBottom: '3px', fontSize: '11px', fontWeight: 'bold' }}>
                <div style={{ fontSize: '12px', fontWeight: '900', marginBottom: '2px', textTransform: 'uppercase' }}>
                  💳 PAYMENT DETAILS:
                </div>
                <div><strong>Method:</strong> {order.payment_method || 'N/A'}</div>
                <div><strong>Status:</strong> {order.payment_status?.replace('_', ' ').toUpperCase()}</div>
                {order.payment_reference && <div><strong>Reference:</strong> {order.payment_reference}</div>}
              </div>
              
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '2px 0' }}>
                - - - - - - - - - - - - - - - - - -
              </div>
              
              {/* Footer */}
              <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                <div><strong>Thank you for your order!</strong></div>
                <div><strong>🍽️ Starters Small Chops 🍽️</strong></div>
                {receiptContent.adminEmail && (
                  <div>📧 {receiptContent.adminEmail}</div>
                )}
                
                <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', margin: '2px 0' }}>
                  - - - - - - - - - - - - - - - - - -
                </div>
                
                {businessInfo?.printed_by && (
                  <div style={{ 
                    fontSize: '10px', 
                    marginTop: '4px', 
                    textAlign: 'center', 
                    fontWeight: '900', 
                    textTransform: 'uppercase',
                    border: '1px dashed black',
                    padding: '2px'
                  }}>
                    <div><strong>🖨️ PRINTED BY:</strong> {businessInfo.printed_by}</div>
                    {businessInfo.printed_on && (
                      <div><strong>📅 ON:</strong> {businessInfo.printed_on}</div>
                    )}
                    {businessInfo.printer_type && (
                      <div><strong>🖨️ PRINTER:</strong> {businessInfo.printer_type}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-between items-center gap-3">
            <Button onClick={onClose} variant="outline" className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Close Preview
            </Button>
            <Button onClick={onPrint} className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Printer className="h-4 w-4 mr-2" />
              Print Now
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
            <strong>📏 Note:</strong> This preview simulates 80mm (3.15 inch) thermal paper width with bold fonts for optimal readability on POS thermal printers.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};