
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDeliveryZonesWithFees } from '@/api/delivery';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import DeliveryZoneList from './delivery/DeliveryZoneList';
import DeliveryZoneDialog from './delivery/DeliveryZoneDialog';
import { DeliveryZoneWithFee } from '@/api/delivery';
import { Skeleton } from '@/components/ui/skeleton';

const DeliveryManagementTab = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<DeliveryZoneWithFee | null>(null);

  const { data: zones, isLoading, error } = useQuery<DeliveryZoneWithFee[]>({
    queryKey: ['deliveryZones'],
    queryFn: getDeliveryZonesWithFees,
  });

  const handleAddNew = () => {
    setSelectedZone(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (zone: DeliveryZoneWithFee) => {
    setSelectedZone(zone);
    setIsDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedZone(null);
  }

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['deliveryZones'] });
    handleCloseDialog();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Delivery Management</CardTitle>
            <CardDescription>
              Define delivery zones and set corresponding fees.
            </CardDescription>
          </div>
          <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Zone
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {error && <p className="text-red-500">Failed to load delivery zones: {error.message}</p>}
          {zones && <DeliveryZoneList zones={zones} onEdit={handleEdit} />}
        </CardContent>
      </Card>
      {isDialogOpen && <DeliveryZoneDialog
        isOpen={isDialogOpen}
        onOpenChange={handleCloseDialog}
        onSuccess={handleSuccess}
        zone={selectedZone}
      />}
    </>
  );
};

export default DeliveryManagementTab;
