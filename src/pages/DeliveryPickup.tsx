
import React, { useState } from "react";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DeliveryMap, { Vehicle } from "@/components/DeliveryMap";
import VehicleSidePanel from "@/components/VehicleSidePanel";
import DeliveryDetailsPanel, { DeliveryDetails } from "@/components/DeliveryDetailsPanel";

// Mock vehicle data
const MOCK_VEHICLES: Vehicle[] = [
  {
    id: "van1",
    type: "van",
    driver: "Bola A.",
    location: { lng: 3.399, lat: 6.539 }, // Central Lagos
    status: "delivering",
    eta: "10 min",
  },
  {
    id: "bike1",
    type: "bike",
    driver: "Dare R.",
    location: { lng: 3.362, lat: 6.510 },
    status: "online",
    eta: "18 min",
  },
  {
    id: "van2",
    type: "van",
    driver: "Chinedu D.",
    location: { lng: 3.407, lat: 6.529 },
    status: "available",
  },
  {
    id: "bike2",
    type: "bike",
    driver: "Peace M.",
    location: { lng: 3.391, lat: 6.620 },
    status: "delivering",
    eta: "25 min",
  },
];

// Mock deliveries data (normally you'd fetch this from backend)
const MOCK_DELIVERIES: DeliveryDetails[] = [
  {
    id: "order1",
    orderNumber: "ORD9627",
    customerName: "Okechi Daniels",
    customerPhone: "+2347033321123",
    address: "22 Broad St, Lagos",
    total: "₦6,500",
    status: "out_for_delivery",
    assignedVehicleId: "van1",
  },
  {
    id: "order2",
    orderNumber: "ORD9871",
    customerName: "Blessing Ajayi",
    customerPhone: "+2348021123341",
    address: "13 Toyin St, Ikeja",
    total: "₦4,950",
    status: "preparing",
    assignedVehicleId: "bike1",
  },
  {
    id: "order3",
    orderNumber: "ORD9919",
    customerName: "Haruna Musa",
    customerPhone: "+2347098765432",
    address: "42 Yaba Crescent, Yaba",
    total: "₦8,000",
    status: "delivering",
    assignedVehicleId: "bike2",
  },
  {
    id: "order4",
    orderNumber: "ORD9123",
    customerName: "Adaeze Obi",
    customerPhone: "+2348100099123",
    address: "1B Masha Road, Surulere",
    total: "₦12,500",
    status: "ready",
    assignedVehicleId: "van2",
  },
  {
    id: "order5",
    orderNumber: "ORD9444",
    customerName: "Peace Oke",
    customerPhone: "+2348034000040",
    address: "9 Bankole St, Maryland",
    total: "₦2,350",
    status: "out_for_delivery",
    assignedVehicleId: "bike2",
  },
];

export default function DeliveryPickupPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  return (
    <div className="w-full h-[calc(100vh-110px)] flex flex-col gap-4">
      {/* Map section */}
      <div className="h-2/5 min-h-[250px] max-h-[350px] w-full relative rounded-lg overflow-hidden">
        <DeliveryMap
          vehicles={MOCK_VEHICLES}
          selectedVehicleId={selectedVehicle?.id}
        />
        {/* Absolute overlay for rider count */}
        <div className="absolute top-3 right-3 z-20 bg-white rounded-md px-4 py-2 flex items-center gap-2 shadow">
          <User className="w-4 h-4 text-teal-600" />
          <span className="font-medium">Online & active:</span>
          <Badge className="bg-teal-100 text-teal-700">{MOCK_VEHICLES.length}</Badge>
        </div>
      </div>
      {/* Bottom grid: Vehicles on left, Details on right */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Vehicles panel */}
        <div className="w-full max-w-xs min-w-[200px] flex-shrink-0 h-full">
          <VehicleSidePanel
            vehicles={MOCK_VEHICLES}
            onSelectVehicle={setSelectedVehicle}
            selectedVehicleId={selectedVehicle?.id}
          />
        </div>
        {/* Details panel */}
        <div className="flex-1 min-w-0 h-full">
          <DeliveryDetailsPanel
            selectedVehicle={selectedVehicle}
            selectedVehicleId={selectedVehicle?.id}
            deliveries={MOCK_DELIVERIES}
          />
        </div>
      </div>
    </div>
  );
}
