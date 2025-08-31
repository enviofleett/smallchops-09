import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Download, Printer } from 'lucide-react';
import { CustomerInfoCard } from '@/components/orders/details/CustomerInfoCard';
import { OrderInfoCard } from '@/components/orders/details/OrderInfoCard';
import { PaymentDetailsCard } from '@/components/orders/PaymentDetailsCard';
import { DeliveryScheduleDisplay } from '@/components/orders/DeliveryScheduleDisplay';
import { ItemsList } from '@/components/orders/details/ItemsList';
import { SpecialInstructions } from '@/components/orders/details/SpecialInstructions';
import { ActionsPanel } from '@/components/orders/details/ActionsPanel';
import { QuickStatsBar } from '@/components/orders/details/QuickStatsBar';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { exportOrderToPDF, exportOrderToCSV } from '@/utils/exportOrder';
import { format } from 'date-fns';
import { toast } from 'sonner';

const AdminOrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data, isLoading, error } = useDetailedOrderData(id || '');
  
  const handleExportPDF = () => {
    if (!data) return;
    try {
      exportOrderToPDF({
        order: data.order,
        items: data.items,
        schedule: data.delivery_schedule,
        paymentTx: null,
        pickupPoint: null
      });
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    try {
      exportOrderToCSV({
        order: data.order,
        items: data.items,
        schedule: data.delivery_schedule,
        paymentTx: null,
        pickupPoint: null
      });
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-32 mx-auto mb-2"></div>
              <div className="h-3 bg-muted rounded w-24 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-4">Failed to load order details</p>
            <Button onClick={() => navigate('/admin/orders')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { order, items, delivery_schedule } = data;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      {/* Header - Hidden on print */}
      <div className="border-b bg-card print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/admin/orders')}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Orders
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Order #{order.order_number}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Order details and management
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={handleExportPDF} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 print:px-0 print:py-4">
        {/* Quick Stats - Mobile and Print */}
        <QuickStatsBar order={order} className="mb-6 lg:hidden print:block" />
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-3 space-y-6">
            <CustomerInfoCard
              customerName={order.customer_name}
              customerPhone={order.customer_phone}
              customerEmail={order.customer_email}
              orderType={order.order_type}
              deliveryAddress={order.delivery_address}
              pickupPoint={undefined}
            />
            
            <OrderInfoCard
              orderNumber={order.order_number}
              orderTime={order.order_time}
              orderType={order.order_type}
              status={order.status}
              paymentStatus={order.payment_status}
              paymentReference={order.payment_reference}
              totalAmount={order.total_amount}
              deliverySchedule={delivery_schedule}
              isLoadingSchedule={false}
              recoveryError={false}
              onRecoveryAttempt={() => {}}
            />
            
            {delivery_schedule && (
              <DeliveryScheduleDisplay
                schedule={delivery_schedule}
                orderType={order.order_type}
                orderStatus={order.status}
              />
            )}
            
            <PaymentDetailsCard
              paymentStatus={order.payment_status}
              totalAmount={order.total_amount}
              paymentMethod={order.payment_method}
              paidAt={order.paid_at}
              paymentReference={order.payment_reference}
            />
            
            <ItemsList
              items={items}
              subtotal={order.subtotal || 0}
              totalVat={order.total_vat || 0}
              totalDiscount={order.discount_amount || 0}
              deliveryFee={order.delivery_fee || 0}
              grandTotal={order.total_amount}
            />
            
            <SpecialInstructions
              instructions={order.special_instructions}
              deliveryInstructions={delivery_schedule?.special_instructions}
            />
          </div>
          
          {/* Actions Panel - Right Side - Hidden on print */}
          <div className="lg:col-span-1 print:hidden">
            <div className="sticky top-6">
              <ActionsPanel
                selectedStatus={order.status}
                onStatusChange={() => {}}
                assignedRider={order.assigned_rider_id}
                onRiderChange={() => {}}
                riders={[]}
                manualStatus={''}
                onManualStatusChange={() => {}}
                onManualSend={() => {}}
                onUpdate={() => {}}
                onVerifyPayment={() => {}}
                paymentReference={order.payment_reference}
                isUpdating={false}
                isSendingManual={false}
                isVerifying={false}
                verifyState="idle"
                verifyMessage=""
              />
            </div>
          </div>
        </div>
        
        {/* Print Footer */}
        <div className="hidden print:block print:mt-8 print:pt-4 print:border-t print:text-center print:text-xs print:text-gray-500">
          <p>Generated on {format(new Date(), 'PPP')} • Order #{order.order_number}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetails;