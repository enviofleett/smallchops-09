import React, { useState, useEffect } from "react";
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
  const { drivers = [] } = useDriverManagement();
  const { updateStatus } = useProductionStatusUpdate();
  const { sendOrderEmail } = useGmailOrderEmail();

  const [assigningDriver, setAssigningDriver] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Debug logs
  useEffect(() => {
    console.log("ORDER DATA:", order);
    console.log("DRIVERS:", drivers);
  }, [order, drivers]);

  // Handler for assigning driver
  const handleAssignDriver = async (driverId) => {
    if (!order || !driverId) return;
    setAssigningDriver(true);
    try {
      // Uncomment and implement if you have assignDriver API:
      // await assignDriver(order.id, driverId);
      await sendOrderEmail({
        to: order.customer_email,
        type: "rider-assigned",
        orderId: order.id,
        driverId,
      });
      refetch();
    } catch (e) {
      alert("Failed to assign driver.");
      console.error(e);
    }
    setAssigningDriver(false);
  };

  // Handler for status change
  const handleChangeStatus = async (e) => {
    const status = e.target.value;
    if (!order || !status) return;
    setUpdatingStatus(true);
    try {
      await updateStatus({ orderId: order.id, status });
      await sendOrderEmail({
        to: order.customer_email,
        type: "status-update",
        orderId: order.id,
        status,
      });
      refetch();
    } catch (e) {
      alert("Failed to update status.");
      console.error(e);
    }
    setUpdatingStatus(false);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error || !order) return <div>Error loading order.</div>;

  // Always use order.items, not order.order_items or other properties!
  const items = Array.isArray(order.items) ? order.items : [];
  const hasDrivers = Array.isArray(drivers) && drivers.length > 0;

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
              <div>Name: {order.customer_name || "-"}</div>
              <div>Email: {order.customer_email || "-"}</div>
              <div>Phone: {order.customer_phone || "-"}</div>
            </div>
          </section>
          {/* Payment details */}
          <section>
            <h3 className="font-semibold text-base">Payment Details</h3>
            <div className="text-sm space-y-1">
              <div>Status: {order.payment_status || "-"}</div>
              <div>Method: {order.payment_method || "-"}</div>
              <div>Reference: {order.payment_reference || "-"}</div>
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
                    value={order.assigned_rider_id ?? ""}
                    disabled={!hasDrivers || assigningDriver}
                    onChange={e => handleAssignDriver(e.target.value)}
                  >
                    <option value="">
                      {hasDrivers ? "Select a driver..." : "No active drivers available"}
                    </option>
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
            <h3 className="font-semibold text-base">Order Items ({items.length})</h3>
            {items.length === 0 ? (
              <div className="text-gray-500 flex items-center gap-2">
                <span role="img" aria-label="empty">📦</span> No items found in this order
              </div>
            ) : (
              <ul className="text-sm space-y-2">
                {items.map(item => (
                  <li key={item.id || item.product_id}>
                    <b>{item.name}</b> &times;{item.quantity} — ₦{item.total_price?.toLocaleString?.() ?? item.unit_price?.toLocaleString?.() ?? "-"}
                    {item.special_instructions && (
                      <div className="text-xs text-gray-500">Note: {item.special_instructions}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* Timeline */}
          <section>
            <h3 className="font-semibold text-base">Order Timeline</h3>
            <ol className="text-xs list-decimal ml-5">
              {(order.timeline || []).length === 0 ? (
                <li className="text-gray-500">No timeline events.</li>
              ) : (
                order.timeline.map(ev => (
                  <li key={ev.step} className={ev.completed ? "text-green-600" : "text-gray-500"}>
                    {ev.label} <span className="ml-2 text-gray-400">{ev.datetime}</span>
                  </li>
                ))
              )}
            </ol>
          </section>
          {/* Action Center */}
          {isAdmin && (
            <section>
              <h3 className="font-semibold text-base">Admin Actions</h3>
              <div className="flex flex-col gap-2">
                <label>
                  Update Order Status
                  <select value={order.status} onChange={handleChangeStatus} disabled={updatingStatus}>
                    {"pending,confirmed,preparing,ready,out_for_delivery,delivered,cancelled,refunded,completed,returned"
                      .split(",")
                      .map(status => (
                        <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
                      ))}
                  </select>
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refetch}
                  disabled={assigningDriver || updatingStatus}
                >
                  Refresh
                </Button>
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}