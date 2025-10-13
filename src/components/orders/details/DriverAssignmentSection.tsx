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
  return <Card>
      
      
    </Card>;
}