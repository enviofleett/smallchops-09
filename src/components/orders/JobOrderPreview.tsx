import React from 'react';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { OrderWithItems } from '@/api/orders';

interface JobOrderPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  order: OrderWithItems;
  items: any[];
  deliverySchedule?: any;
  pickupPoint?: any;
}

export const JobOrderPreview: React.FC<JobOrderPreviewProps> = ({
  isOpen,
  onClose,
  onPrint,
  order,
  items,
  deliverySchedule,
  pickupPoint
}) => {
  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
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

  return (
    <AdaptiveDialog 
      open={isOpen} 
      onOpenChange={onClose}
      title="Job Order Preview"
      size="lg"
      className="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Preview Header */}
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Job Order Preview</h3>
            <p className="text-sm text-blue-700">Review before printing</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onPrint} variant="default" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Print Now
            </Button>
            <Button onClick={onClose} variant="outline" size="sm">
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>

        {/* Job Order Content Preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Header Section */}
          <div className="text-center border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-900">JOB ORDER</h1>
            <div className="mt-2 space-y-1">
              <p className="text-lg font-semibold">Order #{order.order_number}</p>
              <p className="text-sm text-gray-600">
                Generated: {format(new Date(), 'PPP')} at {format(new Date(), 'p')}
              </p>
            </div>
          </div>

          {/* Order Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Customer Information */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold border-b pb-2">Customer Information</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Name:</span> {order.customer_name}</p>
                <p><span className="font-medium">Email:</span> {order.customer_email}</p>
                <p><span className="font-medium">Phone:</span> {order.customer_phone}</p>
              </div>
            </div>

            {/* Order Details */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold border-b pb-2">Order Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {order.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Payment:</span>
                  <Badge variant={getStatusBadgeVariant(order.payment_status)}>
                    {order.payment_status.toUpperCase()}
                  </Badge>
                </div>
                <p><span className="font-medium">Type:</span> {order.order_type.toUpperCase()}</p>
                <p><span className="font-medium">Placed:</span> {format(new Date(order.order_time), 'PPP p')}</p>
              </div>
            </div>
          </div>

          {/* Delivery/Pickup Information */}
          {order.order_type === 'delivery' ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold border-b pb-2">Delivery Information</h3>
              <div className="space-y-2">
                {order.delivery_address && typeof order.delivery_address === 'object' && (
                  <div>
                    <span className="font-medium">Address:</span>
                    <div className="ml-4 text-sm">
                      {(order.delivery_address as any).address?.address_line_1 && (
                        <p>{(order.delivery_address as any).address.address_line_1}</p>
                      )}
                      {(order.delivery_address as any).address?.address_line_2 && (
                        <p>{(order.delivery_address as any).address.address_line_2}</p>
                      )}
                      {((order.delivery_address as any).address?.city || (order.delivery_address as any).address?.state) && (
                        <p>{(order.delivery_address as any).address?.city}, {(order.delivery_address as any).address?.state}</p>
                      )}
                      {(order.delivery_address as any).address?.landmark && (
                        <p>Landmark: {(order.delivery_address as any).address.landmark}</p>
                      )}
                    </div>
                  </div>
                )}
                {deliverySchedule && (
                  <div>
                    <p><span className="font-medium">Scheduled Date:</span> {
                      deliverySchedule.delivery_date ? 
                      format(new Date(deliverySchedule.delivery_date), 'PPP') : 
                      'Not scheduled'
                    }</p>
                    <p><span className="font-medium">Time Window:</span> {
                      deliverySchedule.delivery_time_start && deliverySchedule.delivery_time_end
                        ? `${deliverySchedule.delivery_time_start} - ${deliverySchedule.delivery_time_end}`
                        : 'Flexible'
                    }</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold border-b pb-2">Pickup Information</h3>
              <div className="space-y-2">
                {pickupPoint && (
                  <>
                    <p><span className="font-medium">Location:</span> {pickupPoint.name}</p>
                    <p><span className="font-medium">Address:</span> {pickupPoint.address}</p>
                    {pickupPoint.contact_phone && (
                      <p><span className="font-medium">Contact:</span> {pickupPoint.contact_phone}</p>
                    )}
                  </>
                )}
                <p><span className="font-medium">Pickup Time:</span> {
                  order.pickup_time ? 
                  format(new Date(order.pickup_time), 'PPP p') : 
                  'TBD'
                }</p>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold border-b pb-2">Order Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Item</th>
                    <th className="text-center p-3 font-medium">Qty</th>
                    <th className="text-right p-3 font-medium">Unit Price</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{item.product_name || item.product?.name}</p>
                          {item.customizations && (
                            <p className="text-xs text-gray-500">Customizations: {item.customizations}</p>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-3">{item.quantity}</td>
                      <td className="text-right p-3">{formatCurrency(item.unit_price)}</td>
                      <td className="text-right p-3 font-medium">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Summary */}
          <div className="border-t pt-4">
            <div className="space-y-2 max-w-sm ml-auto">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatCurrency(order.tax_amount)}</span>
                </div>
              )}
              {order.delivery_fee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span>{formatCurrency(order.delivery_fee)}</span>
                </div>
              )}
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Special Instructions */}
          {order.special_instructions && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold border-b pb-2">Special Instructions</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-sm">{order.special_instructions}</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button onClick={onPrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print Job Order
          </Button>
        </div>
      </div>
    </AdaptiveDialog>
  );
};