import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useDriverManagement } from "@/hooks/useDriverManagement";
import { useProductionStatusUpdate } from "@/hooks/useProductionStatusUpdate";
import { useGmailOrderEmail } from "@/hooks/useGmailOrderEmail";

export default function LiveOrderDetailsModal({ orderId, open, onClose, isAdmin }) {
  // Fetch real order data
  const {
    order,
    isLoading,
    error,
    refetch,
    connectionStatus,
  } = useOrderDetails(orderId);

  // Admin-only hooks
  const { drivers } = useDriverManagement();
  const { updateStatus } = useProductionStatusUpdate();
  const { sendOrderEmail } = useGmailOrderEmail();

  // Handler for assigning driver
  const handleAssignDriver = async (driverId) => {
    // await assignDriver(order.id, driverId); // enable if you have this mutation
    await sendOrderEmail({
      to: order.customer_email,
      type: "rider-assigned",
      orderId: order.id,
      driverId,
    });
    refetch();
  };

  // Handler for status change
  const handleChangeStatus = async (status) => {
    await updateStatus({ orderId: order.id, status });
    await sendOrderEmail({
      to: order.customer_email,
      type: "status-update",
      orderId: order.id,
      status,
    });
    refetch();
  };

  if (isLoading) return <div>Loading...</div>;
  if (error || !order) return <div>Error loading order.</div>;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Order #{order.order_number}
            <span className="ml-2 px-2 py-1 rounded bg-gray-200 text-xs font-semibold">
              {order.status}
            </span>
            <span className="ml-2 text-xs text-gray-400">{order.order_type}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="pt-2 space-y-4">
          {/* Live order connection status */}
          <div className="text-xs flex items-center gap-2">
            Connection status: <span className={connectionStatus === "connected" ? "text-green-600" : "text-gray-500"}>{connectionStatus}</span>
          </div>
          {/* Customer info */}
          <section>
            <h3 className="font-semibold text-base">Customer Information</h3>
            <div className="text-sm space-y-1">
              <div>Name: {order.customer_name}</div>
              <div>Email: {order.customer_email}</div>
              <div>Phone: {order.customer_phone}</div>
            </div>
          </section>
          {/* Payment details */}
          <section>
            <h3 className="font-semibold text-base">Payment Details</h3>
            <div className="text-sm space-y-1">
              <div>Status: {order.payment_status}</div>
              <div>Method: {order.payment_method}</div>
              <div>Reference: {order.payment_reference}</div>
            </div>
          </section>
          {/* Financial Breakdown */}
          <section>
            <h3 className="font-semibold text-base">Financial Breakdown</h3>
            <div className="text-sm space-y-1">
              <div>Subtotal: ₦{order.subtotal?.toLocaleString() ?? "-"}</div>
              <div>Delivery Fee: ₦{order.delivery_fee?.toLocaleString() ?? "-"}</div>
              <div>Total: ₦{order.total_amount?.toLocaleString() ?? "-"}</div>
            </div>
          </section>
          {/* Fulfillment */}
          <section>
            <h3 className="font-semibold text-base">Delivery Details</h3>
            <div className="text-sm space-y-1">
              <div>Address: {order.delivery_address?.display ?? "-"}</div>
              <div>Window: {order.delivery_window ?? "-"}</div>
              <div>Instructions: {order.special_instructions ?? "-"}</div>
              <div>
                Assigned Driver: {order.assigned_rider_name ?? "Not assigned"}
              </div>
              {isAdmin && (
                <div>
                  <select
                    defaultValue={order.assigned_rider_id ?? ""}
                    onChange={e => handleAssignDriver(e.target.value)}
                  >
                    <option value="">Select Driver</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>
          {/* Items */}
          <section>
            <h3 className="font-semibold text-base">Order Items</h3>
            <ul className="text-sm space-y-2">
              {order.items.map(item => (
                <li key={item.id}>
                  <b>{item.name}</b> &times;{item.quantity} — ₦{item.total_price?.toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
          {/* Timeline */}
          <section>
            <h3 className="font-semibold text-base">Order Timeline</h3>
            <ol className="text-xs list-decimal ml-5">
              {(order.timeline || []).map(ev => (
                <li key={ev.step} className={ev.completed ? "text-green-600" : "text-gray-500"}>
                  {ev.label} <span className="ml-2 text-gray-400">{ev.datetime}</span>
                </li>
              ))}
            </ol>
          </section>
          {/* Action Center */}
          {isAdmin && (
            <section>
              <h3 className="font-semibold text-base">Action Center</h3>
              <div className="flex flex-wrap gap-2">
                <select defaultValue={order.status} onChange={e => handleChangeStatus(e.target.value)}>
                  {"pending, confirmed, preparing, ready, out_for_delivery, delivered, cancelled, refunded, completed, returned".split(", ").map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={refetch}>Refresh</Button>
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}