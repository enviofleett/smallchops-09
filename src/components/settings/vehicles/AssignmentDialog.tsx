
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Vehicle } from "@/api/vehicles";

type DispatchRider = { id: string; name: string | null; };

type Props = {
  open: boolean;
  vehicle: Vehicle | null;
  riders: DispatchRider[];
  onAssign: (riderId: string, notes?: string) => void;
  onClose: () => void;
};

export default function AssignmentDialog({ open, vehicle, riders, onAssign, onClose }: Props) {
  const [selected, setSelected] = React.useState("");
  const [notes, setNotes] = React.useState("");
  React.useEffect(() => {
    setSelected("");
    setNotes("");
  }, [open, vehicle]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Assign Vehicle {vehicle ? `(${vehicle.license_plate})` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="block text-sm mb-1">Assign to Dispatch Rider</label>
            <select className="w-full border rounded p-2"
              value={selected}
              onChange={e => setSelected(e.target.value)}
            >
              <option value="">Select rider...</option>
              {riders.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Notes</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => { if (selected) onAssign(selected, notes); }}
            disabled={!selected}
          >Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
