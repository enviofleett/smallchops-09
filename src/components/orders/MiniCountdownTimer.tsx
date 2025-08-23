import React, { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle, Truck } from 'lucide-react';
import { calculateDeliveryTime } from '@/utils/scheduleTime';

interface MiniCountdownTimerProps {
  deliveryDate: string;
  deliveryTimeStart: string;
  deliveryTimeEnd: string;
  orderStatus?: string;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  status: 'upcoming' | 'today' | 'active' | 'passed' | 'within_two_hours';
  isOverdue: boolean;
}

export const MiniCountdownTimer: React.FC<MiniCountdownTimerProps> = ({
  deliveryDate,
  deliveryTimeStart,
  deliveryTimeEnd,
  orderStatus = 'pending',
  className = ''
}) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    status: 'upcoming',
    isOverdue: false
  });

  const calculateTimeRemaining = (): TimeRemaining => {
    return calculateDeliveryTime(deliveryDate, deliveryTimeStart, deliveryTimeEnd);
  };

  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(calculateTimeRemaining());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deliveryDate, deliveryTimeStart, deliveryTimeEnd]);

  const getStatusConfig = () => {
    if (orderStatus === 'delivered' || orderStatus === 'completed') {
      return {
        icon: <CheckCircle className="h-3 w-3 text-green-500" />,
        text: 'Delivered',
        className: 'bg-green-50 text-green-700 border-green-200'
      };
    }

    if (orderStatus === 'out_for_delivery') {
      return {
        icon: <Truck className="h-3 w-3 text-blue-500" />,
        text: 'Out for Delivery',
        className: 'bg-blue-50 text-blue-700 border-blue-200'
      };
    }

    switch (timeRemaining.status) {
      case 'active':
        return {
          icon: <Truck className="h-3 w-3 text-green-500" />,
          text: 'Delivery Active',
          className: 'bg-green-50 text-green-700 border-green-200'
        };
      case 'within_two_hours':
        return {
          icon: <Clock className="h-3 w-3 text-green-500" />,
          text: `${timeRemaining.hours}h ${timeRemaining.minutes}m`,
          className: 'bg-green-50 text-green-700 border-green-200'
        };
      case 'today':
        return {
          icon: <Clock className="h-3 w-3 text-orange-500" />,
          text: `${timeRemaining.hours}h ${timeRemaining.minutes}m`,
          className: 'bg-orange-50 text-orange-700 border-orange-200'
        };
      case 'upcoming':
        if (timeRemaining.days === 0) {
          return {
            icon: <Clock className="h-3 w-3 text-blue-500" />,
            text: `${timeRemaining.hours}h ${timeRemaining.minutes}m`,
            className: 'bg-blue-50 text-blue-700 border-blue-200'
          };
        }
        return {
          icon: <Calendar className="h-3 w-3 text-gray-500" />,
          text: timeRemaining.days === 1 ? 'Tomorrow' : `${timeRemaining.days} days`,
          className: 'bg-gray-50 text-gray-700 border-gray-200'
        };
      case 'passed':
        const overdueText = timeRemaining.days > 0 
          ? `${timeRemaining.days}d overdue`
          : timeRemaining.hours > 0
          ? `${timeRemaining.hours}h overdue`
          : `${timeRemaining.minutes}m overdue`;
        
        return {
          icon: <Clock className="h-3 w-3 text-red-500" />,
          text: overdueText,
          className: 'bg-red-50 text-red-700 border-red-200'
        };
      default:
        return {
          icon: <Calendar className="h-3 w-3 text-gray-500" />,
          text: 'Scheduled',
          className: 'bg-gray-50 text-gray-700 border-gray-200'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-xs font-medium ${config.className} ${className}`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};