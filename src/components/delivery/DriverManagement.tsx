import React, { useState } from 'react';
import { Plus, Edit, Trash2, Car, Bike, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { DriverDialog } from './DriverDialog';
import type { Driver } from '@/api/drivers';

const vehicleIcons = {
  car: Car,
  motorcycle: Bike,
  bicycle: Truck,
  van: Truck
};

export const DriverManagement = () => {
  const { drivers, loading, addDriver, updateDriverData, removeDriver, toggleDriverStatus } = useDriverManagement();
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddDriver = () => {
    setSelectedDriver(null);
    setIsDialogOpen(true);
  };

  const handleEditDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    setIsDialogOpen(true);
  };

  const handleDeleteDriver = async (id: string) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      await removeDriver(id);
    }
  };

  const handleDriverSave = async (driverData: any) => {
    if (selectedDriver) {
      await updateDriverData(selectedDriver.id, driverData);
    } else {
      await addDriver(driverData);
    }
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Driver Management</h2>
        <Button onClick={handleAddDriver}>
          <Plus className="w-4 h-4 mr-2" />
          Add Driver
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading drivers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drivers.map((driver) => {
            const VehicleIcon = vehicleIcons[driver.vehicle_type];
            
            return (
              <Card key={driver.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{driver.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{driver.phone}</p>
                    </div>
                    <Badge variant={driver.is_active ? "default" : "secondary"}>
                      {driver.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <VehicleIcon className="w-4 h-4" />
                    <span className="text-sm capitalize">{driver.vehicle_type}</span>
                  </div>
                  
                  {driver.license_plate && (
                    <div className="text-sm">
                      <span className="font-medium">License:</span> {driver.license_plate}
                    </div>
                  )}
                  
                  {driver.vehicle_brand && driver.vehicle_model && (
                    <div className="text-sm">
                      <span className="font-medium">Vehicle:</span> {driver.vehicle_brand} {driver.vehicle_model}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditDriver(driver)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleDriverStatus(driver.id)}
                    >
                      {driver.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDriver(driver.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DriverDialog
        driver={selectedDriver}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleDriverSave}
      />
    </div>
  );
};