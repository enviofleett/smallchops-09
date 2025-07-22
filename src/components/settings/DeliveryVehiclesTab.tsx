
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getVehicles, createVehicle, updateVehicle, deleteVehicle,
  getDispatchRiders, assignVehicle, unassignVehicle,
  Vehicle, NewVehicle
} from "@/api/vehicles";
import VehicleList from "./vehicles/VehicleList";
import VehicleDialog from "./vehicles/VehicleDialog";
import AssignmentDialog from "./vehicles/AssignmentDialog";
import { toast } from "@/hooks/use-toast";

export default function DeliveryVehiclesTab() {
  const qc = useQueryClient();
  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery({ queryKey: ["vehicles"], queryFn: getVehicles });
  const { data: riders = [] } = useQuery({ queryKey: ["dispatchRiders"], queryFn: getDispatchRiders });

  // Dialog states
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editVehicle, setEditVehicle] = React.useState<Vehicle | null>(null);
  const [assignmentOpen, setAssignmentOpen] = React.useState(false);
  const [assignVehicleObj, setAssignVehicleObj] = React.useState<Vehicle | null>(null);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (vehicle: NewVehicle) => createVehicle(vehicle),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setDialogOpen(false);
      toast({ title: "Vehicle added", variant: "default" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: NewVehicle }) => updateVehicle(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setDialogOpen(false);
      toast({ title: "Vehicle updated", variant: "default" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Vehicle deleted", variant: "default" });
    }
  });

  const assignMutation = useMutation({
    mutationFn: ({ vehicleId, riderId, notes }: { vehicleId: string; riderId: string; notes?: string }) =>
      assignVehicle(vehicleId, riderId, undefined, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setAssignmentOpen(false);
      toast({ title: "Vehicle assigned", variant: "default" });
    }
  });

  const unassignMutation = useMutation({
    mutationFn: (vehicleId: string) => unassignVehicle(vehicleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Vehicle unassigned", variant: "default" });
    }
  });

  function handleEdit(vehicle: Vehicle) {
    setEditVehicle(vehicle);
    setDialogOpen(true);
  }

  function handleNew() {
    setEditVehicle(null);
    setDialogOpen(true);
  }

  function handleDelete(vehicle: Vehicle) {
    if (window.confirm("Delete this vehicle?")) deleteMutation.mutate(vehicle.id);
  }

  function handleAssign(vehicle: Vehicle) {
    setAssignVehicleObj(vehicle);
    setAssignmentOpen(true);
  }

  function handleUnassign(vehicle: Vehicle) {
    if (window.confirm("Unassign this vehicle from all riders?")) unassignMutation.mutate(vehicle.id);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Delivery Vehicles</h2>
          <p className="text-gray-500 text-sm">Manage vehicles and assign to dispatch riders.</p>
        </div>
        <button className="bg-primary text-white px-4 py-2 rounded-xl" onClick={handleNew}>Add Vehicle</button>
      </div>
      {loadingVehicles ?
        <div className="p-8 text-center">Loading...</div>
        :
        <VehicleList
          vehicles={vehicles}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
        />
      }
      <VehicleDialog
        open={dialogOpen}
        vehicle={editVehicle}
        onClose={() => setDialogOpen(false)}
        onSave={values => {
          if (editVehicle)
            updateMutation.mutate({ id: editVehicle.id, fields: values });
          else
            createMutation.mutate(values);
        }}
      />
      <AssignmentDialog
        open={assignmentOpen}
        vehicle={assignVehicleObj}
        riders={riders}
        onAssign={(riderId, notes) => {
          if (assignVehicleObj) {
            assignMutation.mutate({ vehicleId: assignVehicleObj.id, riderId, notes });
          }
        }}
        onClose={() => setAssignmentOpen(false)}
      />
    </div>
  );
}
