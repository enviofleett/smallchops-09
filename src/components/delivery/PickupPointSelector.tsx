
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
    if (!hours || typeof hours !== 'object') return 'Open ⋅ Closes 6 pm';
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = days[new Date().getDay()];
    
    if (hours[todayKey]) {
      return `Today: ${hours[todayKey].open} - ${hours[todayKey].close}`;
    }
    
    return 'Open ⋅ Closes 6 pm';
  };

  const isCurrentlyOpen = (hours: any) => {
    if (!hours || typeof hours !== 'object') {
      // Default to open during business hours (9 AM - 6 PM)
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const openTime = 9 * 60; // 9 AM
      const closeTime = 18 * 60; // 6 PM
      return currentTime >= openTime && currentTime <= closeTime;
    }
    
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
          <Card
            className={`cursor-pointer transition-all ${
              selectedPointId === 'default'
                ? 'ring-2 ring-primary border-primary'
                : 'hover:border-primary/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !disabled && onSelect({
              id: 'default',
              name: 'Main Store',
              address: '2B Close Off 11Crescent Kado Estate, Kado',
              contact_phone: '0807 301 1100',
              operating_hours: {
                monday: { open: '09:00', close: '18:00' },
                tuesday: { open: '09:00', close: '18:00' },
                wednesday: { open: '09:00', close: '18:00' },
                thursday: { open: '09:00', close: '18:00' },
                friday: { open: '09:00', close: '18:00' },
                saturday: { open: '09:00', close: '18:00' },
                sunday: { open: '09:00', close: '18:00' }
              },
              instructions: null,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as PickupPoint)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">Main Store</h3>
                <div className="flex gap-2">
                  {isCurrentlyOpen(null) ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Open
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Closed
                    </Badge>
                  )}
                  {selectedPointId === 'default' && (
                    <Badge variant="default">
                      Selected
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>2B Close Off 11Crescent Kado Estate, Kado</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>0807 301 1100</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Open ⋅ Closes 6 pm</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
