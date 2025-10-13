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
          <Truck className="w-5 h-5" />
          Assign Driver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentDriver && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              <span className="font-medium">{currentDriver.name}</span>
            </div>
            {currentDriver.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{currentDriver.phone}</span>
              </div>
            )}
          </div>
        )}
        
        <Select
          value={selectedDriverId}
          onValueChange={setSelectedDriverId}
          disabled={isLoadingDrivers || isAssigning}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a driver" />
          </SelectTrigger>
          <SelectContent>
            {drivers.filter(d => d.is_active).map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                <div className="flex flex-col">
                  <span>{driver.name}</span>
                  {driver.phone && (
                    <span className="text-xs text-muted-foreground">{driver.phone}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleAssign}
          disabled={!selectedDriverId || isAssigning || selectedDriverId === currentDriverId}
          className="w-full"
        >
          {isAssigning ? 'Assigning...' : 'Assign Driver'}
        </Button>
      </CardContent>
    </Card>
  );
}