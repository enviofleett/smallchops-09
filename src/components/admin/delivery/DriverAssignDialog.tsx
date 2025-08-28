import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Truck } from 'lucide-react';
import { OrderWithItems } from '@/api/orders';

interface DriverAssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: OrderWithItems[];
  onSuccess: () => void;
}

export const DriverAssignDialog: React.FC<DriverAssignDialogProps> = ({
  isOpen,
  onClose,
  selectedOrders,
  onSuccess,
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const { drivers, loading: driversLoading } = useDriverManagement();
  const { toast } = useToast();

  // Only use active drivers
  const activeDrivers = useMemo(
    () => drivers.filter(driver => driver.is_active),
    [drivers]
  );
  const selectedDriver = useMemo(
    () => activeDrivers.find(driver => driver.id === selectedDriverId),
    [selectedDriverId, activeDrivers]
  );

  const handleAssign = async () => {
    setErrorMsg('');
    if (!selectedDriverId || selectedOrders.length === 0) {
      setErrorMsg('Please select a driver and ensure orders are selected.');
      toast({
        title: "Assignment Failed",
        description: "Please select a driver and ensure orders are selected.",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);

    try {
      // Assign driver to each selected order using profile_id
      const assignmentPromises = selectedOrders.map(order =>
        supabase.rpc('assign_rider_to_order', {
          p_order_id: order.id,
          p_rider_id: selectedDriverId,
        })
      );

      const results = await Promise.allSettled(assignmentPromises);

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      if (successful > 0) {
        toast({
          title: "Assignment Successful",
          description: `Successfully assigned driver to ${successful} order${successful === 1 ? '' : 's'}${failed > 0 ? `. ${failed} assignment${failed === 1 ? '' : 's'} failed.` : '.'}`,
        });
        onSuccess();
        handleClose();
      } else {
        throw new Error('All assignments failed');
      }
    } catch (error) {
      setErrorMsg('Failed to assign driver to orders. Please try again.');
      toast({
        title: "Assignment Failed",
        description: "Failed to assign driver to orders. Please try again.",
        variant: "destructive",
      });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Driver to Orders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Assigning driver to {selectedOrders.length} order{selectedOrders.length === 1 ? '' : 's'}:
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {selectedOrders.map(order => (
                <div key={order.id} className="text-sm bg-muted p-2 rounded">
                  #{order.order_number} - {order.customer_name}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="driver-select" className="text-sm font-medium mb-2 block">Select Driver</label>
            {driversLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" aria-label="Loading drivers" />
              </div>
            ) : (
              <Select
                value={selectedDriverId}
                onValueChange={setSelectedDriverId}
                id="driver-select"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a driver..." />
                </SelectTrigger>
                <SelectContent>
                  {activeDrivers.map(driver => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{driver.name}</span>
                        <span className="text-muted-foreground">•</span>
                        <Truck className="w-3 h-3" />
                        <span className="text-xs text-muted-foreground">
                          {driver.vehicle_type} {driver.license_plate ? `(${driver.license_plate})` : ''}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeDrivers.length === 0 && !driversLoading && (
              <p className="text-sm text-muted-foreground mt-2">
                No active drivers available. Please register drivers first.
              </p>
            )}
          </div>

          {errorMsg && (
            <div className="text-destructive text-sm" role="alert">{errorMsg}</div>
          )}

          {selectedDriver && (
            <div className="bg-primary/5 p-3 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Selected:</span> {selectedDriver.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedDriver.vehicle_type} • {selectedDriver.phone}
                {selectedDriver.license_plate && ` • ${selectedDriver.license_plate}`}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              type="button"
              onClick={handleClose}
              disabled={isAssigning}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAssign}
              disabled={!selectedDriverId || isAssigning || activeDrivers.length === 0}
              className="flex-1"
              aria-busy={isAssigning}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Driver'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
