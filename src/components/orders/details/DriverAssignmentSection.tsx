import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Truck, User, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { getDispatchRiders } from "@/api/orders";
import { toast } from "sonner";

interface Driver {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  is_active: boolean;
}

interface DriverAssignmentSectionProps {
  orderId: string;
  currentDriverId?: string;
  currentDriverName?: string;
  onAssignDriver: (driverId: string) => Promise<void>;
  isAssigning: boolean;
}

export function DriverAssignmentSection({
  orderId,
  currentDriverId,
  currentDriverName,
  onAssignDriver,
  isAssigning
}: DriverAssignmentSectionProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(currentDriverId || "");
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(true);

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    if (currentDriverId) {
      setSelectedDriverId(currentDriverId);
    }
  }, [currentDriverId]);

  const loadDrivers = async () => {
    try {
      setIsLoadingDrivers(true);
      const data = await getDispatchRiders();
      setDrivers(data || []);
    } catch (error) {
      console.error('Failed to load drivers:', error);
      toast.error('Failed to load drivers');
    } finally {
      setIsLoadingDrivers(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedDriverId) {
      toast.error('Please select a driver');
      return;
    }
    await onAssignDriver(selectedDriverId);
  };

  const currentDriver = drivers.find(d => d.id === currentDriverId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Driver Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentDriver && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium">Currently Assigned</div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{currentDriver.name}</span>
            </div>
            {currentDriver.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{currentDriver.phone}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {currentDriver ? 'Reassign to' : 'Assign Driver'}
          </label>
          <Select
            value={selectedDriverId}
            onValueChange={setSelectedDriverId}
            disabled={isLoadingDrivers || isAssigning}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a driver" />
            </SelectTrigger>
            <SelectContent>
              {drivers
                .filter(d => d.is_active)
                .map(driver => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleAssign}
          disabled={!selectedDriverId || isAssigning || selectedDriverId === currentDriverId}
          className="w-full"
        >
          {isAssigning ? 'Assigning...' : currentDriver ? 'Reassign Driver' : 'Assign Driver'}
        </Button>
      </CardContent>
    </Card>
  );
}
