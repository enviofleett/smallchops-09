import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PickupPoint, getPickupPoints } from '@/api/deliveryPreferences';
import { MapPin, Phone, Clock } from 'lucide-react';

interface PickupPointSelectorProps {
  selectedPointId?: string;
  onSelect: (pickupPoint: PickupPoint | null) => void;
  disabled?: boolean;
}

export function PickupPointSelector({ selectedPointId, onSelect, disabled }: PickupPointSelectorProps) {
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPickupPoints();
  }, []);

  const loadPickupPoints = async () => {
    try {
      setLoading(true);
      const points = await getPickupPoints();
      setPickupPoints(points);
    } catch (error) {
      console.error('Error loading pickup points:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatOperatingHours = (hours: any) => {
    if (!hours || typeof hours !== 'object') return 'Hours not available';
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = days[new Date().getDay()];
    
    if (hours[todayKey]) {
      return `Today: ${hours[todayKey].open} - ${hours[todayKey].close}`;
    }
    
    return 'Hours vary by day';
  };

  const isCurrentlyOpen = (hours: any) => {
    if (!hours || typeof hours !== 'object') return false;
    
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = days[now.getDay()];
    
    if (!hours[todayKey]) return false;
    
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMin] = hours[todayKey].open.split(':').map(Number);
    const [closeHour, closeMin] = hours[todayKey].close.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;
    
    return currentTime >= openTime && currentTime <= closeTime;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Choose Pickup Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pickupPoints.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No pickup points available at the moment.
            </p>
          ) : (
            pickupPoints.map((point) => (
              <Card
                key={point.id}
                className={`cursor-pointer transition-all ${
                  selectedPointId === point.id
                    ? 'ring-2 ring-primary border-primary'
                    : 'hover:border-primary/50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !disabled && onSelect(point)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{point.name}</h3>
                    <div className="flex gap-2">
                      {isCurrentlyOpen(point.operating_hours) ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Open
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Closed
                        </Badge>
                      )}
                      {selectedPointId === point.id && (
                        <Badge variant="default">
                          Selected
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{point.address}</span>
                    </div>
                    
                    {point.contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{point.contact_phone}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{formatOperatingHours(point.operating_hours)}</span>
                    </div>
                    
                    {point.instructions && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <strong>Instructions:</strong> {point.instructions}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          
          {selectedPointId && (
            <Button
              variant="outline"
              onClick={() => onSelect(null)}
              disabled={disabled}
              className="w-full"
            >
              Clear Selection
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}