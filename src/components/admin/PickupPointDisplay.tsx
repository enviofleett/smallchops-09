import React from 'react';
import { usePickupPoint } from '@/hooks/usePickupPoints';
import { MapPin, Phone, Clock } from 'lucide-react';

interface PickupPointDisplayProps {
  pickupPointId: string;
}

export const PickupPointDisplay: React.FC<PickupPointDisplayProps> = ({ pickupPointId }) => {
  const { data: pickupPoint, isLoading } = usePickupPoint(pickupPointId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
        <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
      </div>
    );
  }

  if (!pickupPoint) {
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-1">Pickup Point</p>
        <p className="text-sm text-red-600">⚠️ Pickup point not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Pickup Location</p>
        <p className="text-sm font-medium">{pickupPoint.name}</p>
        <p className="text-xs text-muted-foreground">{pickupPoint.address}</p>
      </div>
      
      {pickupPoint.contact_phone && (
        <div className="flex items-center gap-1">
          <Phone className="w-3 h-3 text-muted-foreground" />
          <p className="text-xs">{pickupPoint.contact_phone}</p>
        </div>
      )}
      
      {pickupPoint.operating_hours && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <p className="text-xs">
            {typeof pickupPoint.operating_hours === 'string' 
              ? pickupPoint.operating_hours 
              : JSON.stringify(pickupPoint.operating_hours)
            }
          </p>
        </div>
      )}
    </div>
  );
};