
import React from "react";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Vehicle } from "./DeliveryMap";

const getStatusColor = (status: Vehicle["status"]) => {
  switch (status) {
    case "delivering":
      return "bg-yellow-100 text-yellow-700";
    case "online":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-200 text-slate-700";
  }
};

const getTypeColor = (type: Vehicle["type"]) =>
  type === "bike"
    ? "bg-blue-100 text-blue-700"
    : "bg-purple-100 text-purple-700";

type Props = {
  vehicle: Vehicle;
  selected?: boolean;
  onSelect?: () => void;
};

const VehicleCard: React.FC<Props> = ({ vehicle, selected = false, onSelect }) => (
  <div
    className={`rounded-xl border p-4 mb-3 bg-white shadow-sm cursor-pointer transition ring-2 ${
      selected
        ? "ring-blue-400"
        : "ring-transparent hover:ring-blue-200"
    }`}
    onClick={onSelect}
    tabIndex={0}
  >
    <div className="flex items-center gap-2 mb-2">
      <span className={`rounded p-1 text-lg ${getTypeColor(vehicle.type)}`}>
        {vehicle.type === "bike" ? "🚲" : "🚐"}
      </span>
      <div>
        <div className="font-semibold">{vehicle.driver}</div>
        <div className="text-xs text-gray-500 capitalize">{vehicle.type}</div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <Badge className={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
      {vehicle.eta && (
        <span className="text-xs text-gray-400 ml-1">
          ETA: {vehicle.eta}
        </span>
      )}
    </div>
  </div>
);

export default VehicleCard;
