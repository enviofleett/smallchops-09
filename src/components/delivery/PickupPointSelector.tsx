
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

  // Auto-select pickup point if there's only one available - Production Ready
  useEffect(() => {
    if (!loading && 
        pickupPoints.length === 1 && 
        !selectedPointId && 
        !disabled) {
      // Automatically select the only available pickup point
      const singlePickupPoint = pickupPoints[0];
      if (singlePickupPoint.is_active) {
        onSelect(singlePickupPoint);
      }
    }
  }, [loading, pickupPoints, selectedPointId, disabled, onSelect]);

  const loadPickupPoints = async () => {
    try {
      setLoading(true);
      const points = await getPickupPoints();
      setPickupPoints(points);
    } catch (error) {
      console.error('Error loading pickup points:', error);
      // Fallback to default pickup point if API fails
      setPickupPoints([{
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Main Store',
        address: '2B Close Off 11Crescent Kado Estate, Kado',
        contact_phone: '0807 301 1100',
        operating_hours: {
          monday: { open: '08:00', close: '18:00' },
          tuesday: { open: '08:00', close: '18:00' },
          wednesday: { open: '08:00', close: '18:00' },
          thursday: { open: '08:00', close: '18:00' },
          friday: { open: '08:00', close: '18:00' },
          saturday: { open: '08:00', close: '18:00' },
          sunday: { open: '10:00', close: '16:00' }
        },
        instructions: 'Please call us when you arrive for quick pickup',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as PickupPoint]);
    } finally {
      setLoading(false);
    }
  };

  const formatOperatingHours = (hours: any) => {
    // Show production business hours
    return "Mon-Sat: 8:00AM - 6:00PM | Sun: 10:00AM - 4:00PM";
  };

  const isCurrentlyOpen = (hours: any) => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Production business hours:
    // Monday-Saturday: 8am-6pm (8:00-18:00)
    // Sunday: 10am-4pm (10:00-16:00)
    
    if (!hours || typeof hours !== 'object') {
      // Fallback to default business hours if no hours provided
      if (currentDay === 0) { // Sunday
        const openTime = 10 * 60; // 10 AM
        const closeTime = 16 * 60; // 4 PM
        return currentTime >= openTime && currentTime < closeTime;
      } else { // Monday-Saturday
        const openTime = 8 * 60; // 8 AM
        const closeTime = 18 * 60; // 6 PM
        return currentTime >= openTime && currentTime < closeTime;
      }
    }
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayKey = days[currentDay];
    
    if (!hours[todayKey] || !hours[todayKey].open || !hours[todayKey].close) {
      // If no hours for today, return false
      return false;
    }
    
    try {
      const [openHour, openMin] = hours[todayKey].open.split(':').map(Number);
      const [closeHour, closeMin] = hours[todayKey].close.split(':').map(Number);
      const openTime = openHour * 60 + openMin;
      const closeTime = closeHour * 60 + closeMin;
      
      return currentTime >= openTime && currentTime < closeTime;
    } catch (error) {
      console.error('Error parsing operating hours:', error);
      return false;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (pickupPoints.length === 0) {
    return (
      <div className="text-center py-8">
        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No pickup points available</p>
        <p className="text-sm text-muted-foreground mt-1">Please contact us for pickup arrangements</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {pickupPoints.map((point) => {
        const isSelected = selectedPointId === point.id;
        const isOpen = isCurrentlyOpen(point.operating_hours);
        
        return (
          <div
            key={point.id}
            onClick={() => !disabled && onSelect(point)}
            className={`
              p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
              hover:border-primary/20 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
              ${isSelected 
                ? 'border-primary bg-primary/5 shadow-md' 
                : 'border-border'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-base">{point.name}</h3>
              <div className="flex items-center gap-2">
                {isSelected && (
                  <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                )}
                <Badge 
                  variant={isOpen ? "default" : "secondary"}
                  className={isOpen 
                    ? "bg-green-100 text-green-800 border-green-200" 
                    : "bg-red-100 text-red-800 border-red-200"
                  }
                >
                  {isOpen ? 'Open Now' : 'Closed'}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{point.address}</span>
              </div>
              
              {point.contact_phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{point.contact_phone}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>{formatOperatingHours(point.operating_hours)}</span>
              </div>
            </div>

            {point.instructions && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                <span className="font-medium">📋 Pickup Instructions:</span> {point.instructions}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
