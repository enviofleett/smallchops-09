import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, User, Phone, Search, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
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

  // Filter drivers based on search query
  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers;
    const query = searchQuery.toLowerCase().trim();
    return drivers.filter(driver => driver.name.toLowerCase().includes(query) || driver.phone?.toLowerCase().includes(query) || driver.email?.toLowerCase().includes(query));
  }, [drivers, searchQuery]);
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Delivery Agent Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Driver Display */}
        {currentDriver && <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{currentDriver.name}</p>
                  {currentDriver.phone && <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {currentDriver.phone}
                    </p>}
                </div>
              </div>
            </div>
          </div>}

        {/* Driver Selection with Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Assign Delivery Agent</label>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            
            {searchQuery && <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>}
          </div>

          {/* Driver Select with Filtered Results */}
          <div className="flex gap-2">
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId} disabled={isLoadingDrivers || isAssigning}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={isLoadingDrivers ? "Loading drivers..." : "Select a driver"} />
              </SelectTrigger>
              <SelectContent>
                {filteredDrivers.length === 0 ? <div className="p-3 text-sm text-muted-foreground text-center">
                    {searchQuery ? 'No drivers found matching your search' : 'No drivers available'}
                  </div> : filteredDrivers.map(driver => <SelectItem key={driver.id} value={driver.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{driver.name}</span>
                        {driver.phone && <span className="text-xs text-muted-foreground">
                            ({driver.phone})
                          </span>}
                      </div>
                    </SelectItem>)}
              </SelectContent>
            </Select>
            
            <Button onClick={handleAssign} disabled={!selectedDriverId || isAssigning || selectedDriverId === currentDriverId} size="default">
              {isAssigning ? 'Assigning...' : 'Assign'}
            </Button>
          </div>

          {/* Search Results Count */}
          {searchQuery && filteredDrivers.length > 0 && <p className="text-xs text-muted-foreground">
              Found {filteredDrivers.length} driver{filteredDrivers.length !== 1 ? 's' : ''}
            </p>}
        </div>

        {/* Unassign Button */}
        {currentDriverId && <Button variant="outline" onClick={() => onAssignDriver('')} disabled={isAssigning} className="w-full">
            Unassign Driver
          </Button>}
      </CardContent>
    </Card>;
}