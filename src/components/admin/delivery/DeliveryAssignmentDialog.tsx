import React, { useState } from 'react';
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
  onAssign: (orderIds: string[], driverId: string) => void;
  drivers: Driver[];
}

export function DeliveryAssignmentDialog({
  isOpen,
  onClose,
  selectedOrderIds,
  onAssign,
  drivers
}: DeliveryAssignmentDialogProps) {
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async () => {
    if (!selectedDriverId) return;
    
    setIsAssigning(true);
    try {
      // Pass profile_id (which is now the id from getDispatchRiders)
      await onAssign(selectedOrderIds, selectedDriverId);
      onClose();
      setSelectedDriverId('');
    } catch (error) {
      console.error('Assignment failed:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = () => {
    setSelectedDriverId('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Assign Driver
          </DialogTitle>
          <DialogDescription>
            Assign a driver to {selectedOrderIds.length} selected order(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Orders Count */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium mb-2">Selected Orders:</p>
            <Badge variant="outline">
              {selectedOrderIds.length} order{selectedOrderIds.length > 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Driver Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Driver:</label>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a driver..." />
              </SelectTrigger>
              <SelectContent>
                {drivers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No active drivers available
                  </div>
                ) : (
                  drivers.map((driver) => (
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

          {/* Driver Info Preview */}
          {selectedDriverId && (
            <div className="p-3 border rounded-lg">
              {(() => {
                const selectedDriver = drivers.find(d => d.id === selectedDriverId);
                if (!selectedDriver) return null;
                
                return (
                  <div>
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
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedDriverId || isAssigning || drivers.length === 0}
            className="min-w-[100px]"
          >
            {isAssigning ? 'Assigning...' : 'Assign Driver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}