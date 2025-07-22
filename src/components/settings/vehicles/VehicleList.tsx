
import React from "react";
import { Vehicle } from "@/api/vehicles";
import { Button } from "@/components/ui/button";
import { Edit, Trash, Repeat } from "lucide-react";

type Props = {
  vehicles: Vehicle[];
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
  onAssign: (vehicle: Vehicle) => void;
  onUnassign: (vehicle: Vehicle) => void;
};

export default function VehicleList({ vehicles, onEdit, onDelete, onAssign, onUnassign }: Props) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm bg-white rounded-xl border">
        <thead>
          <tr className="border-b text-xs text-gray-600">
            <th className="p-3">Plate</th>
            <th className="p-3">Type</th>
            <th className="p-3">Brand</th>
            <th className="p-3">Model</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map(v => (
            <tr key={v.id} className="border-b hover:bg-gray-50">
              <td className="p-3">{v.license_plate}</td>
              <td className="p-3 capitalize">{v.type}</td>
              <td className="p-3">{v.brand || "-"}</td>
              <td className="p-3">{v.model || "-"}</td>
              <td className="p-3 capitalize">{v.status}</td>
              <td className="p-3 flex flex-col md:flex-row gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(v)}>
                  <Edit className="w-4 h-4 mr-1" />Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(v)}>
                  <Trash className="w-4 h-4 mr-1" />Delete
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onAssign(v)} disabled={v.status === "assigned"}>
                  <Repeat className="w-4 h-4 mr-1" />Assign
                </Button>
                {v.status === "assigned" && (
                  <Button variant="ghost" size="sm" onClick={() => onUnassign(v)}>
                    Unassign
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {vehicles.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-500">No vehicles found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
