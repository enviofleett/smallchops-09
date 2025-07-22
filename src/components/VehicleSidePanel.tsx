
import React, { useState } from "react";
import VehicleCard from "./VehicleCard";
import type { Vehicle } from "./DeliveryMap";

type Props = {
  vehicles: Vehicle[];
  onSelectVehicle?: (v: Vehicle) => void;
  selectedVehicleId?: string;
};

const VehicleSidePanel: React.FC<Props> = ({
  vehicles,
  onSelectVehicle,
  selectedVehicleId,
}) => (
  <aside className="bg-white w-full xl:w-80 sm:w-72 max-w-full h-full border-r flex flex-col p-4 overflow-y-auto">
    <h2 className="text-xl font-bold mb-4">Delivery Vehicles</h2>
    <div className="flex flex-col gap-1">
      {vehicles.map((vehicle) => (
        <VehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          onSelect={onSelectVehicle ? () => onSelectVehicle(vehicle) : undefined}
          selected={selectedVehicleId === vehicle.id}
        />
      ))}
    </div>
  </aside>
);

export default VehicleSidePanel;
