import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface DeliveryCountdownProps {
  deliveryDate: string;
  deliveryTimeStart: string;
  className?: string;
}

export const DeliveryCountdown: React.FC<DeliveryCountdownProps> = ({
  deliveryDate,
  deliveryTimeStart,
  className = ""
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const [hours, minutes] = deliveryTimeStart.split(':');
      const deliveryDateTime = new Date(deliveryDate);
      deliveryDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const now = new Date();
      const difference = deliveryDateTime.getTime() - now.getTime();

      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        };
      }

      return null;
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    // Calculate initial time
    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [deliveryDate, deliveryTimeStart]);

  if (!timeLeft) {
    return (
      <Card className={`border-green-200 bg-green-50 ${className}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-center gap-2 text-green-700">
            <Truck className="h-5 w-5" />
            <span className="font-medium">Delivery time has arrived!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-primary bg-primary/5 ${className}`}>
      <CardContent className="pt-4">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Delivery Countdown</span>
          </div>
          
          <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
            {/* Days */}
            <div className="text-center">
              <div className="bg-primary text-primary-foreground rounded-lg p-2 font-bold text-lg leading-none">
                {timeLeft.days.toString().padStart(2, '0')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Days</p>
            </div>
            
            {/* Hours */}
            <div className="text-center">
              <div className="bg-primary text-primary-foreground rounded-lg p-2 font-bold text-lg leading-none">
                {timeLeft.hours.toString().padStart(2, '0')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Hours</p>
            </div>
            
            {/* Minutes */}
            <div className="text-center">
              <div className="bg-primary text-primary-foreground rounded-lg p-2 font-bold text-lg leading-none">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Min</p>
            </div>
            
            {/* Seconds */}
            <div className="text-center">
              <div className="bg-primary/70 text-primary-foreground rounded-lg p-2 font-bold text-lg leading-none">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Sec</p>
            </div>
          </div>

          <Badge variant="outline" className="border-primary text-primary">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(deliveryDate).toLocaleDateString('en-NG', {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            })} at {deliveryTimeStart}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};