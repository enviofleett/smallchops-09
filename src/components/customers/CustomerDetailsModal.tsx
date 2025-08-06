import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Mail, Phone, MapPin, Truck, FileText, Package } from "lucide-react";
import { getCustomerDeliveryHistory } from "@/api/customers";
import { Customer } from "@/types/customers";
import { formatAddress } from '@/utils/formatAddress';

interface CustomerDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

export const CustomerDetailsModal = ({
  open,
  onOpenChange,
  customer,
}: CustomerDetailsModalProps) => {
  const [orders, setOrders] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !customer) return;
    setLoading(true);
    setErr(null);
    getCustomerDeliveryHistory(customer.name, customer.phone)
      .then(setOrders)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [open, customer]);

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-3">
              <span className="inline-flex w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold items-center justify-center text-lg">
                {customer.name.charAt(0)}
              </span>
              <span className="text-xl font-semibold">{customer.name}</span>
            </div>
          </DialogTitle>
          <DialogDescription>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-8 mt-2 mb-2">
              <span className="flex items-center gap-2 text-gray-700 text-sm">
                <Mail className="h-4 w-4" /> {customer.email}
              </span>
              {customer.phone && (
                <span className="flex items-center gap-2 text-gray-700 text-sm">
                  <Phone className="h-4 w-4" /> {customer.phone}
                </span>
              )}
              <span className="flex items-center gap-2 text-gray-700 text-sm">
                <FileText className="h-4 w-4" /> {customer.totalOrders} orders&nbsp;|&nbsp;₦
                {customer.totalSpent.toLocaleString()}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>
        <h3 className="font-semibold text-md mt-2 mb-3">Delivery History</h3>
        {loading && (
          <div className="text-center py-8 text-gray-600">Loading...</div>
        )}
        {err && (
          <div className="text-center py-8 text-red-500">{err}</div>
        )}
        {!loading && !err && orders.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No delivery records found for this customer.
          </div>
        )}
        {!loading && !err && orders.length > 0 && (
          <div className="divide-y">
            {orders.map((order) => (
              <div key={order.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-base font-medium text-gray-800">
                    <span>
                      <Truck className="h-4 w-4 text-blue-500" />
                    </span>
                    <span>Order #{order.order_number}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(order.order_time).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 text-gray-700 text-sm truncate">
                    <MapPin className="h-4 w-4 text-purple-500" />
                    <span className="truncate">
                      {formatAddress(order.delivery_address)}
                    </span>
                  </div>

                  {/* Package/Products section */}
                  {order.order_items && order.order_items.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2 font-medium text-gray-700 mb-1">
                        <Package className="h-4 w-4 text-gray-500" />
                        <span>Package Details</span>
                      </div>
                      <ul className="pl-7 list-disc space-y-1">
                        {order.order_items.map((item) => (
                          <li
                            key={item.id}
                            className="text-sm text-gray-700 flex items-center gap-2"
                          >
                            <span>
                              {item.quantity}x {item.product?.name || "Unknown Product"}
                            </span>
                            <span className="text-xs text-gray-500">
                              (₦{Number(item.price).toLocaleString()} each)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start md:items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full border border-gray-200 bg-gray-50">
                      {order.delivery_method?.charAt(0).toUpperCase() +
                        order.delivery_method?.slice(1)}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        order.status === "delivered"
                          ? "bg-green-100 text-green-800"
                          : order.status === "cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {order.status
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                  <div className="font-semibold text-gray-800">
                    ₦{Number(order.total_amount).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
