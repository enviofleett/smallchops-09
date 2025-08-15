import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { DriverDialog } from '@/components/delivery/DriverDialog';
import { 
  UserPlus, 
  Edit, 
  Trash2, 
  Power, 
  Search,
  Car,
  Bike,
  Truck
} from 'lucide-react';
import type { Driver } from '@/api/drivers';

const vehicleIcons = {
  car: Car,
  motorcycle: Bike,
  bicycle: Bike,
  van: Truck,
};

export const AdminDriversTab: React.FC = () => {
  const { 
    drivers, 
    loading, 
    error, 
    addDriver, 
    updateDriverData, 
    removeDriver, 
    toggleDriverStatus 
  } = useDriverManagement();

  const [searchQuery, setSearchQuery] = useState('');
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    driver.phone.includes(searchQuery) ||
    driver.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddDriver = async (driverData: any) => {
    try {
      await addDriver(driverData);
      setIsDriverDialogOpen(false);
    } catch (error) {
      console.error('Failed to add driver:', error);
    }
  };

  const handleEditDriver = async (driverData: any) => {
    if (!editingDriver) return;
    
    try {
      await updateDriverData(editingDriver.id, driverData);
      setEditingDriver(null);
    } catch (error) {
      console.error('Failed to update driver:', error);
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    try {
      await removeDriver(driverId);
    } catch (error) {
      console.error('Failed to delete driver:', error);
    }
  };

  const handleToggleStatus = async (driverId: string) => {
    try {
      await toggleDriverStatus(driverId);
    } catch (error) {
      console.error('Failed to toggle driver status:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p>Failed to load drivers</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Add Button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search drivers by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setIsDriverDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Driver
        </Button>
      </div>

      {/* Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((driver) => {
          const VehicleIcon = vehicleIcons[driver.vehicle_type] || Car;
          
          return (
            <Card key={driver.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{driver.name}</CardTitle>
                  <Badge variant={driver.is_active ? 'default' : 'secondary'}>
                    {driver.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="text-muted-foreground">Phone:</span>
                    <span>{driver.phone}</span>
                  </p>
                  {driver.email && (
                    <p className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="truncate">{driver.email}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <VehicleIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm capitalize">{driver.vehicle_type}</span>
                    {driver.license_plate && (
                      <Badge variant="outline" className="text-xs">
                        {driver.license_plate}
                      </Badge>
                    )}
                  </div>
                  {(driver.vehicle_brand || driver.vehicle_model) && (
                    <p className="text-xs text-muted-foreground">
                      {[driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingDriver(driver)}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  
                  <Button
                    variant={driver.is_active ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleToggleStatus(driver.id)}
                  >
                    <Power className="w-3 h-3 mr-1" />
                    {driver.is_active ? 'Deactivate' : 'Activate'}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Driver</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {driver.name}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteDriver(driver.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredDrivers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No drivers found' : 'No drivers registered'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Start by adding your first delivery driver'
              }
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsDriverDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add First Driver
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Driver Dialog */}
      <DriverDialog
        open={isDriverDialogOpen}
        onOpenChange={setIsDriverDialogOpen}
        onSave={handleAddDriver}
      />

      {/* Edit Driver Dialog */}
      <DriverDialog
        open={!!editingDriver}
        onOpenChange={(open) => !open && setEditingDriver(null)}
        driver={editingDriver || undefined}
        onSave={handleEditDriver}
      />
    </div>
  );
};