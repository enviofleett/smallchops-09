
import React from "react";
import { useForm } from "react-hook-form";
import { Vehicle, NewVehicle } from "@/api/vehicles";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  vehicle?: Vehicle | null;
  onClose: () => void;
  onSave: (data: NewVehicle) => void;
};

const types = ["bike", "van", "truck"] as const;
const statuses = ["available", "assigned", "maintenance", "inactive"] as const;

export default function VehicleDialog({ open, vehicle, onClose, onSave }: Props) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<NewVehicle>({
    defaultValues: vehicle ? { ...vehicle } : {}
  });

  React.useEffect(() => {
    reset(vehicle || {});
  }, [vehicle, reset]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
        </DialogHeader>
        <form className="p-6 pt-0 space-y-4" onSubmit={handleSubmit(onSave)}>
          <div>
            <label className="block text-sm mb-1">License Plate</label>
            <Input {...register("license_plate", { required: true })} />
            {errors.license_plate && <span className="text-xs text-red-400">Required</span>}
          </div>
          <div>
            <label className="block text-sm mb-1">Type</label>
            <select {...register("type", { required: true })} className="w-full border rounded p-2">
              {types.map(t => (
                <option value={t} key={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Brand</label>
            <Input {...register("brand")} />
          </div>
          <div>
            <label className="block text-sm mb-1">Model</label>
            <Input {...register("model")} />
          </div>
          <div>
            <label className="block text-sm mb-1">Notes</label>
            <Input {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="submit">{vehicle ? "Save Changes" : "Add Vehicle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
