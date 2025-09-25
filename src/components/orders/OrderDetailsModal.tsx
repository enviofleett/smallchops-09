import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import {
  Printer, CheckCircle2, XCircle, Clock, ArrowRight, Settings, Package,
  CreditCard, Truck, Timer, MessageSquare, Hash, AlertCircle, Calendar, Building2
} from 'lucide-react';

// Status options for actions
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-600' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-600' },
  { value: 'preparing', label: 'Preparing', icon: Settings, color: 'text-orange-600' },
  { value: 'ready', label: 'Ready', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: ArrowRight, color: 'text-purple-600' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-700' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600' }
];

// Main Modal Component
export const OrderDetailsModal = ({
  order,
  deliverySchedule,
  isOpen,
  onClose
}) => {
  const [selectedTab, setSelectedTab] = useState('summary');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: detailedOrderData, isLoading, error } = useDetailedOrderData(order?.id);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${order?.order_number}`,
    onAfterPrint: () => toast.success('Order details printed successfully'),
    onPrintError: () => toast.error('Failed to print order details')
  });

  const handleStatusUpdate = async (newStatus) => {
    setIsUpdatingStatus(true);
    try {
      // Implement your update logic here
      // await updateOrderStatus(order.id, newStatus);
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!order) return null;

  return (
    <AdaptiveDialog
      open={isOpen}
      onOpenChange={onClose}
      size="xl"
      className="max-w-7xl h-[95vh]"
    >
      <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/10" ref={printRef}>
        <OrderDetailsHeader
          order={order}
          onPrint={handlePrint}
        />
        <OrderDetailsTabs
          order={order}
          deliverySchedule={deliverySchedule}
          detailedOrderData={detailedOrderData}
          isLoading={isLoading}
          error={error}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          isUpdatingStatus={isUpdatingStatus}
          handleStatusUpdate={handleStatusUpdate}
        />
        <OrderDetailsFooter onClose={onClose} />
      </div>
    </AdaptiveDialog>
  );
};


// OrderDetailsHeader
function OrderDetailsHeader({ order, onPrint }) {
  return (
    <div className="flex-shrink-0 border-b-2 bg-gradient-to-r from-primary/5 via-background to-accent/5 px-6 py-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-7 h-7 text-primary" />
              Order #{order.order_number}
            </h1>
            <Badge
              variant={order.status === 'delivered' ? 'default' : 'secondary'}
              className="text-sm px-3 py-1 font-medium capitalize"
            >
              {order.status?.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Complete order fulfillment details • Last updated {new Date(order.updated_at || order.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              ₦{order.total_amount?.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Truck className="w-4 h-4" />
              {order.order_type}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="print:hidden border-primary/20 hover:border-primary/40"
            aria-label={`Print order ${order.order_number} details`}
          >
            <Printer className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Print Details</span>
            <span className="sm:hidden">Print</span>
          </Button>
        </div>
      </div>
    </div>
  );
}


// Tab Navigation & Content
function OrderDetailsTabs({
  order,
  deliverySchedule,
  detailedOrderData,
  isLoading,
  error,
  selectedTab,
  setSelectedTab,
  isUpdatingStatus,
  handleStatusUpdate,
}) {
  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'fulfillment', label: 'Fulfillment' },
    { key: 'actions', label: 'Actions' },
    { key: 'timeline', label: 'Timeline' }
  ];

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b bg-muted/10 px-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`px-4 py-3 font-semibold focus:outline-none transition-colors ${selectedTab === tab.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-primary'}`}
            onClick={() => setSelectedTab(tab.key)}
            aria-selected={selectedTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedTab === 'summary' && (
          <SummaryTab order={order} deliverySchedule={deliverySchedule} />
        )}
        {selectedTab === 'fulfillment' && (
          <FulfillmentTab detailedOrderData={detailedOrderData} isLoading={isLoading} error={error} />
        )}
        {selectedTab === 'actions' && (
          <ActionsTab
            order={order}
            isUpdatingStatus={isUpdatingStatus}
            handleStatusUpdate={handleStatusUpdate}
          />
        )}
        {selectedTab === 'timeline' && (
          <TimelineTab detailedOrderData={detailedOrderData} isLoading={isLoading} error={error} order={order} />
        )}
      </div>
    </div>
  );
}


// SummaryTab
function SummaryTab({ order, deliverySchedule }) {
  return (
    <Card className="rounded-xl border shadow-sm mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-2">Customer & Order Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-2 font-medium">Customer</div>
            <div>Name: {order.customer?.name || 'N/A'}</div>
            <div>Phone: {order.customer?.phone || 'N/A'}</div>
            <div>Address: {order.customer?.address || 'N/A'}</div>
          </div>
          <div>
            <div className="mb-2 font-medium">Payment</div>
            <div>Status: <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>{order.payment_status}</Badge></div>
            <div>Method: {order.payment_method || 'N/A'}</div>
            <div>Reference: {order.payment_reference || 'N/A'}</div>
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-2 font-medium">Items</div>
          <OrderItemsTable items={order.items || []} />
        </div>
        <div className="mt-6">
          <div className="mb-2 font-medium">Delivery</div>
          <div>
            {order.order_type === 'pickup' ? (
              <><Building2 className="inline w-4 h-4" /> Pickup</>
            ) : (
              <><Truck className="inline w-4 h-4" /> Delivery</>
            )}
            {deliverySchedule ? (
              <span className="ml-2 text-muted-foreground">
                {deliverySchedule.window} on {deliverySchedule.date}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Items Table
function OrderItemsTable({ items }) {
  if (!items.length) return <div className="text-muted-foreground">No items</div>;
  return (
    <table className="w-full text-sm border rounded">
      <thead>
        <tr className="font-bold">
          <th className="text-left py-2">Item</th>
          <th className="text-right py-2">Qty</th>
          <th className="text-right py-2">Price</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td className="py-2">{item.name}</td>
            <td className="py-2 text-right">{item.quantity}</td>
            <td className="py-2 text-right">₦{item.price?.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


// FulfillmentTab
function FulfillmentTab({ detailedOrderData, isLoading, error }) {
  if (isLoading) return <div className="text-center py-10">Loading fulfillment data...</div>;
  if (error) return <div className="text-destructive">Error loading details.</div>;
  if (!detailedOrderData) return <div className="text-muted-foreground">No fulfillment data.</div>;
  return (
    <Card className="border shadow-sm rounded-xl mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Order Fulfillment Progress</h2>
        <OrderProgressBar steps={detailedOrderData.steps || []} />
        <div className="mt-6">
          <div className="mb-2 font-medium">Assigned Agent</div>
          <div>{detailedOrderData.assigned_agent?.name || 'Unassigned'}</div>
        </div>
        <div className="mt-6">
          <div className="mb-2 font-medium">Instructions</div>
          <div>{detailedOrderData.instructions || 'None'}</div>
        </div>
      </div>
    </Card>
  );
}

// Progress Bar
function OrderProgressBar({ steps }) {
  const statusOrder = [
    'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'
  ];
  return (
    <div className="flex gap-4 items-center">
      {statusOrder.map((status, idx) => {
        const step = steps?.find(s => s.status === status);
        const Icon = STATUS_OPTIONS.find(opt => opt.value === status)?.icon || Clock;
        const active = !!step;
        return (
          <div key={status} className="flex flex-col items-center">
            <Icon className={`w-6 h-6 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className={`text-xs mt-1 capitalize ${active ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{status.replace('_', ' ')}</div>
            {step && step.timestamp && (
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(step.timestamp).toLocaleString()}</div>
            )}
            {idx < statusOrder.length - 1 && (
              <div className="h-8 border-l-2 border-muted/60 mx-auto"></div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ActionsTab
function ActionsTab({ order, isUpdatingStatus, handleStatusUpdate }) {
  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-lg mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Order Actions & Status Management</h2>
        <div className="mb-6">
          <div className="font-medium mb-2">Quick Status Updates</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {STATUS_OPTIONS.map((status) => {
              const Icon = status.icon;
              const isActive = order.status === status.value;
              const isDisabled = isUpdatingStatus;
              return (
                <Button
                  key={status.value}
                  variant={isActive ? "default" : "outline"}
                  size="lg"
                  disabled={isDisabled}
                  onClick={() => handleStatusUpdate(status.value)}
                  className={`
                    h-auto py-4 px-3 flex flex-col items-center gap-2 text-xs
                    transition-all duration-200 hover:scale-105
                    ${isActive ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : 'hover:shadow-md'}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : status.color}`} />
                  <span className="leading-tight text-center font-medium">{status.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
        <div className="pt-6 border-t border-muted/30">
          <div className="font-medium mb-2">Additional Actions</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" size="sm" className="h-12 flex flex-col items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs">Notify Customer</span>
            </Button>
            <Button variant="outline" size="sm" className="h-12 flex flex-col items-center gap-1">
              <Hash className="w-4 h-4" />
              <span className="text-xs">Generate Invoice</span>
            </Button>
            <Button variant="outline" size="sm" className="h-12 flex flex-col items-center gap-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">View History</span>
            </Button>
            <Button variant="outline" size="sm" className="h-12 flex flex-col items-center gap-1 text-destructive hover:text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Cancel Order</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}


// TimelineTab
function TimelineTab({ detailedOrderData, isLoading, error, order }) {
  if (isLoading) return <div className="text-center py-10">Loading timeline...</div>;
  if (error) return <div className="text-destructive">Error loading timeline.</div>;
  const timeline = detailedOrderData?.timeline || [];
  return (
    <Card className="rounded-xl border shadow-sm mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Order Timeline</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-6">
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">
              {new Date(order.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
            <p className="font-medium">
              {new Date(order.updated_at || order.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium capitalize flex items-center gap-1">
              {order.order_type === 'pickup' ? (<Building2 className="w-3 h-3" />) : (<Truck className="w-3 h-3" />)}
              {order.order_type}
            </p>
          </div>
        </div>
        <ul className="space-y-3">
          {timeline.length ? timeline.map((event, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-medium capitalize">{event.event.replace('_', ' ')}</span>
              <span className="text-muted-foreground">
                {event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}
              </span>
            </li>
          )) : <div className="text-muted-foreground">No timeline events</div>}
        </ul>
      </div>
    </Card>
  );
}


// Modal Footer
function OrderDetailsFooter({ onClose }) {
  return (
    <div className="flex justify-end border-t px-6 py-4 gap-3">
      <Button variant="outline" onClick={onClose}>Close</Button>
      <Button variant="ghost">Help</Button>
    </div>
  );
}
