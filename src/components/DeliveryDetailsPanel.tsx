
import React from "react";
import type { Vehicle } from "./DeliveryMap";

// This mock can be replaced with order data from backend later
export type DeliveryDetails = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  total: string;
  status: string;
  assignedVehicleId?: string;
};

type Props = {
  selectedVehicle?: Vehicle | null;
  selectedVehicleId?: string | null;
  deliveries: DeliveryDetails[];
};

const statusColor: Record<string, string> = {
  'confirmed': 'bg-blue-100 text-blue-600',
  'preparing': 'bg-yellow-100 text-yellow-700',
  'ready': 'bg-green-100 text-green-700',
  'out_for_delivery': 'bg-purple-100 text-purple-700',
  'delivered': 'bg-gray-100 text-gray-700',
  'cancelled': 'bg-red-100 text-red-600',
  'delivering': 'bg-yellow-100 text-yellow-700', // supports status in mock
};

const DeliveryDetailsPanel: React.FC<Props> = ({ selectedVehicle, selectedVehicleId, deliveries }) => {
  // Filter deliveries assigned to selected vehicle
  const filtered = selectedVehicle
    ? deliveries.filter(d => d.assignedVehicleId === selectedVehicle.id)
    : deliveries.slice(0, 3);

  return (
    <aside className="bg-white w-full h-full rounded-xl border p-5 overflow-y-auto">
      <h2 className="font-bold text-lg mb-4">
        {selectedVehicle
          ? `Assigned Deliveries (${selectedVehicle.driver})`
          : "Active Deliveries"}
      </h2>
      {filtered.length === 0 && (
        <div className="text-gray-500 text-sm py-12 text-center">
          No deliveries assigned.
        </div>
      )}
      <div className="flex flex-col gap-5">
        {filtered.map((delivery) => {
          const highlight = selectedVehicleId
            && delivery.assignedVehicleId === selectedVehicleId;
          return (
            <div
              key={delivery.id}
              className={`border rounded-xl p-4 bg-white shadow-sm transition 
                ${highlight ? "ring-2 ring-blue-500 bg-blue-50 animate-fade-in" : ""}
              `}
            >
              <div className="flex items-center mb-2 gap-2">
                <span className="text-sm font-semibold text-gray-700">Order:</span>
                <span className="text-blue-800 font-bold">{delivery.orderNumber}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[delivery.status] || "bg-gray-100 text-gray-700"}`}>
                  {delivery.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-sm">
                <div><span className="font-medium">Customer:</span> {delivery.customerName}</div>
                <div>
                  <span className="font-medium">Phone:</span>
                  <a href={`tel:${delivery.customerPhone}`} className="text-blue-600 underline">{delivery.customerPhone}</a>
                </div>
                <div><span className="font-medium">Address:</span> {delivery.address}</div>
                <div><span className="font-medium">Total:</span> {delivery.total}</div>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  );
};

export default DeliveryDetailsPanel;
