
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { DeliveryZoneWithFee } from '@/api/delivery';
import { deleteDeliveryZone } from '@/api/delivery';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type DeliveryZoneListProps = {
  zones: DeliveryZoneWithFee[];
  onEdit: (zone: DeliveryZoneWithFee) => void;
};

const DeliveryZoneList = ({ zones, onEdit }: DeliveryZoneListProps) => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const deleteMutation = useMutation({
        mutationFn: deleteDeliveryZone,
        onSuccess: () => {
            toast({ title: "Zone deleted successfully" });
            queryClient.invalidateQueries({ queryKey: ['deliveryZones'] });
        },
        onError: (error) => {
            toast({ title: "Error deleting zone", description: error.message, variant: "destructive" });
        }
    });

    if (zones.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg">
                <p className="text-gray-500">No delivery zones defined yet.</p>
                <p className="text-sm text-gray-400">Click "Add New Zone" to get started.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {zones.map(zone => (
                <div key={zone.id} className="border p-4 rounded-lg flex justify-between items-center transition-shadow hover:shadow-md">
                    <div>
                        <h3 className="font-semibold text-lg">{zone.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{zone.description}</p>
                        <div className="text-xs text-gray-500 mt-2 space-x-4">
                            <span>Base Fee: <strong>₦{zone.delivery_fees?.base_fee ?? '0'}</strong></span>
                            <span>Fee/km: <strong>{zone.delivery_fees?.fee_per_km ? `₦${zone.delivery_fees.fee_per_km}` : 'N/A'}</strong></span>
                            <span>Free Delivery Over: <strong>{zone.delivery_fees?.min_order_for_free_delivery ? `₦${zone.delivery_fees.min_order_for_free_delivery}` : 'N/A'}</strong></span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="icon" onClick={() => onEdit(zone)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit Zone</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" disabled={deleteMutation.isPending}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete Zone</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the "{zone.name}" delivery zone and its fees.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(zone.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DeliveryZoneList;
