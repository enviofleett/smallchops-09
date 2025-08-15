import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck } from 'lucide-react';
import { getDeliveryZonesWithFees, DeliveryZoneWithFee } from '@/api/delivery';
import { toast } from 'sonner';

interface DeliveryZoneSelectorProps {
  selectedZoneId?: string;
  onZoneSelect: (zoneId: string, deliveryFee: number) => void;
  orderSubtotal: number;
}

export const DeliveryZoneSelector: React.FC<DeliveryZoneSelectorProps> = ({
  selectedZoneId,
  onZoneSelect,
  orderSubtotal
}) => {
  const [zones, setZones] = useState<DeliveryZoneWithFee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const data = await getDeliveryZonesWithFees();
      setZones(data);
    } catch (error) {
      console.error('Error fetching zones:', error);
      toast.error('Failed to load delivery zones');
    } finally {
      setLoading(false);
    }
  };

  const calculateDeliveryFee = (zone: DeliveryZoneWithFee): number => {
    if (!zone.delivery_fees) return 0;
    
    const { base_fee, min_order_for_free_delivery } = zone.delivery_fees;
    
    // Check if order qualifies for free delivery
    if (min_order_for_free_delivery && orderSubtotal >= min_order_for_free_delivery) {
      return 0;
    }
    
    return base_fee;
  };

  const handleZoneSelect = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    
    const deliveryFee = calculateDeliveryFee(zone);
    onZoneSelect(zoneId, deliveryFee);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Select Delivery Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading delivery zones...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (zones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Delivery Not Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            No delivery zones are currently configured. Please contact support.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Select Delivery Zone *
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedZoneId} onValueChange={handleZoneSelect}>
          <div className="space-y-3">
            {zones.map((zone) => {
              const deliveryFee = calculateDeliveryFee(zone);
              const isFreeDelivery = deliveryFee === 0 && zone.delivery_fees?.min_order_for_free_delivery;
              
              return (
                <div key={zone.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value={zone.id} id={zone.id} className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={zone.id} className="flex items-center gap-2 cursor-pointer">
                      <MapPin className="w-4 h-4" />
                      <span className="font-medium">{zone.name}</span>
                      {deliveryFee === 0 ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {isFreeDelivery ? 'FREE' : 'No Charge'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          ₦{deliveryFee.toFixed(2)}
                        </Badge>
                      )}
                    </Label>
                    {zone.description && (
                      <p className="text-sm text-muted-foreground">
                        {zone.description}
                      </p>
                    )}
                    {zone.delivery_fees?.min_order_for_free_delivery && (
                      <p className="text-xs text-muted-foreground">
                        Free delivery on orders above ₦{zone.delivery_fees.min_order_for_free_delivery.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
};