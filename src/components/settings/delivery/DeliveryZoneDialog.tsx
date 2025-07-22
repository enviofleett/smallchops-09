
import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DeliveryZoneWithFee, upsertDeliveryZoneWithFee } from '@/api/delivery';
import DeliveryZoneMap from './DeliveryZoneMap';
import { FeatureCollection } from 'geojson';
import { NewDeliveryZone } from '@/types/database';

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: () => void;
  zone: DeliveryZoneWithFee | null;
};

const DeliveryZoneDialog = ({ isOpen, onOpenChange, onSuccess, zone }: Props) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseFee, setBaseFee] = useState('');
  const [feePerKm, setFeePerKm] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [area, setArea] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (zone) {
        setName(zone.name);
        setDescription(zone.description || '');
        setBaseFee(zone.delivery_fees?.base_fee?.toString() ?? '0');
        setFeePerKm(zone.delivery_fees?.fee_per_km?.toString() ?? '');
        setMinOrder(zone.delivery_fees?.min_order_for_free_delivery?.toString() ?? '');
        setArea(zone.area ? (zone.area as unknown as FeatureCollection) : null);
      } else {
        setName('');
        setDescription('');
        setBaseFee('0');
        setFeePerKm('');
        setMinOrder('');
        setArea(null);
      }
    }
  }, [zone, isOpen]);

  const mutation = useMutation({
    mutationFn: upsertDeliveryZoneWithFee,
    onSuccess: () => {
      toast({ title: `Zone ${zone ? 'updated' : 'created'} successfully` });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: `Error ${zone ? 'updating' : 'creating'} zone`,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!area || area.features.length === 0) {
      toast({ title: 'A delivery area must be drawn on the map', variant: 'destructive' });
      return;
    }

    const zonePayload: NewDeliveryZone = {
      ...(zone?.id && { id: zone.id }),
      name,
      description,
      area: area as any,
    };

    const feePayload = {
      ...(zone?.delivery_fees?.id && { id: zone.delivery_fees.id }),
      base_fee: parseFloat(baseFee) || 0,
      fee_per_km: feePerKm ? parseFloat(feePerKm) : null,
      min_order_for_free_delivery: minOrder ? parseFloat(minOrder) : null,
    };
    
    mutation.mutate({ zone: zonePayload, fee: feePayload });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{zone ? 'Edit Delivery Zone' : 'Create New Delivery Zone'}</DialogTitle>
          <DialogDescription>
            Draw the zone on the map and set the delivery fees. Click the polygon icon to start drawing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            <div className="space-y-4">
                <div>
                    <Label htmlFor="name">Zone Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={mutation.isPending}/>
                </div>
                <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={mutation.isPending}/>
                </div>
                <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium">Fee Structure</h4>
                     <div>
                        <Label htmlFor="baseFee">Base Fee (₦)</Label>
                        <Input id="baseFee" type="number" value={baseFee} onChange={(e) => setBaseFee(e.target.value)} placeholder="e.g. 500" disabled={mutation.isPending}/>
                    </div>
                     <div>
                        <Label htmlFor="feePerKm">Fee per KM (₦) (optional)</Label>
                        <Input id="feePerKm" type="number" value={feePerKm} onChange={(e) => setFeePerKm(e.target.value)} placeholder="e.g. 100" disabled={mutation.isPending}/>
                    </div>
                     <div>
                        <Label htmlFor="minOrder">Minimum Order for Free Delivery (₦) (optional)</Label>
                        <Input id="minOrder" type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} placeholder="e.g. 10000" disabled={mutation.isPending}/>
                    </div>
                </div>
            </div>
            <div className="h-96 md:h-auto min-h-[400px] rounded-lg overflow-hidden border">
                <DeliveryZoneMap initialArea={area} onAreaChange={setArea} />
            </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Zone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryZoneDialog;
