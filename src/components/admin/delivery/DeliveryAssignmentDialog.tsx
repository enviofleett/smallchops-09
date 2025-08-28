import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Truck, User, Phone } from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  is_active: boolean;
}

interface DeliveryAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrderIds: string[];
  onAssign: (orderIds: string[], driverId: string) => Promise<void>;
  drivers: Driver[];
}

export function DeliveryAssignmentDialog({
  isOpen,
  onClose,
  selectedOrderIds,
  onAssign,
  drivers
}: DeliveryAssignmentDialogProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Only show active drivers in dropdown
  const activeDrivers = useMemo(
    () => drivers.filter(driver => driver.is_active),
    [drivers]
  );

  const selectedDriver = useMemo(
    () => activeDrivers.find(d => d.id === selectedDriverId),
    [selectedDriverId, activeDrivers]
  );

  const handleAssign = async () => {
    setErrorMsg('');
    if (!selectedDriverId) {
      setErrorMsg('Please select a driver.');
      return;
    }
    setIsAssigning(true);
    try {
      await onAssign(selectedOrderIds, selectedDriverId);
      handleClose();
    } catch (error) {
      setErrorMsg('Assignment failed, please try again.');
      // Optionally log error with a monitoring service
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = () => {
    setSelectedDriverId('');
    setErrorMsg('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" aria-label="Assign Driver" />
            Assign Driver
          </DialogTitle>
          <DialogDescription>
            Assign a driver to {selectedOrderIds.length} selected order{selectedOrderIds.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Orders Count */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium mb-2">Selected Orders:</p>
            <Badge variant="outline" aria-label="Selected Orders Count">
              {selectedOrderIds.length} order{selectedOrderIds.length > 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Driver Selection */}
          <div className="space-y-2">
            <label htmlFor="driver-select" className="text-sm font-medium">
              Select Driver:
            </label>
            <Select
              value={selectedDriverId}
              onValueChange={setSelectedDriverId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a driver..." />
              </SelectTrigger>
              <SelectContent>
                {activeDrivers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No active drivers available
                  </div>
                ) : (
                  activeDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="font-medium">{driver.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {driver.phone}
                            </span>
                            <span className="capitalize">{driver.vehicle_type}</span>
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="text-destructive text-sm" role="alert">
              {errorMsg}
            </div>
          )}

          {/* Driver Info Preview */}
          {selectedDriver && (
            <div className="p-3 border rounded-lg">
              <p className="font-medium mb-2">Selected Driver:</p>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {selectedDriver.name}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {selectedDriver.phone}
                </p>
                <p className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  {selectedDriver.vehicle_type}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!selectedDriverId || isAssigning || activeDrivers.length === 0}
            className="min-w-[100px]"
            aria-busy={isAssigning}
          >
            {isAssigning ? 'Assigning...' : 'Assign Driver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
