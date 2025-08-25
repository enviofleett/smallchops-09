import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

interface CountdownTimerProps {
  deliveryDate: string;
  deliveryTimeStart: string;
  deliveryTimeEnd: string;
  isFlexible?: boolean;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  status: 'upcoming' | 'today' | 'active' | 'passed';
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  deliveryDate,
  deliveryTimeStart,
  deliveryTimeEnd,
  isFlexible = false,
  className = ""
}) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    status: 'upcoming'
  });

  const calculateTimeRemaining = () => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      const deliveryDateTime = new Date(deliveryDate);
      const [startHours, startMinutes] = deliveryTimeStart.split(':').map(Number);
      const [endHours, endMinutes] = deliveryTimeEnd.split(':').map(Number);
      
      // Validate parsed time values
      if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
        throw new Error('Invalid time format');
      }
      
      const deliveryStart = new Date(deliveryDate);
      deliveryStart.setHours(startHours, startMinutes, 0, 0);
      
      const deliveryEnd = new Date(deliveryDate);
      deliveryEnd.setHours(endHours, endMinutes, 0, 0);
      
      // Validate constructed dates
      if (isNaN(deliveryStart.getTime()) || isNaN(deliveryEnd.getTime())) {
        throw new Error('Invalid delivery date/time');
      }
      
      const diffToStart = deliveryStart.getTime() - now.getTime();
      const diffToEnd = deliveryEnd.getTime() - now.getTime();
      
      let status: TimeRemaining['status'] = 'upcoming';
      let targetTime = diffToStart;
      
      // Determine status
      if (diffToEnd < 0) {
        status = 'passed';
        targetTime = Math.abs(diffToEnd); // Show how long it's been overdue
      } else if (diffToStart <= 0 && diffToEnd > 0) {
        status = 'active';
        targetTime = diffToEnd;
      } else if (deliveryDateTime.toDateString() === today.toDateString()) {
        status = 'today';
        targetTime = diffToStart;
      } else {
        status = 'upcoming';
        targetTime = diffToStart;
      }
      
      const days = Math.floor(Math.abs(targetTime) / (1000 * 60 * 60 * 24));
      const hours = Math.floor((Math.abs(targetTime) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((Math.abs(targetTime) % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((Math.abs(targetTime) % (1000 * 60)) / 1000);
      
      return {
        days: Math.max(0, days),
        hours: Math.max(0, hours),
        minutes: Math.max(0, minutes),
        seconds: Math.max(0, seconds),
        status
      };
    } catch (error) {
      console.error('Error calculating countdown time:', error);
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        status: 'upcoming' as const
      };
    }
  };

  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(calculateTimeRemaining());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deliveryDate, deliveryTimeStart, deliveryTimeEnd]);

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusConfig = () => {
    switch (timeRemaining.status) {
      case 'active':
        return {
          title: 'Delivery Window Active!',
          subtitle: 'Your delivery is happening now',
          bgColor: 'bg-green-50 border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
          showCountdown: true,
          countdownLabel: 'Time remaining in window:'
        };
      case 'today':
        return {
          title: 'Delivering Today!',
          subtitle: `Between ${formatTime(deliveryTimeStart)} - ${formatTime(deliveryTimeEnd)}`,
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          showCountdown: true,
          countdownLabel: 'Time until delivery:'
        };
      case 'passed':
        return {
          title: 'OVERDUE - Delivery Window Passed',
          subtitle: `Was scheduled for ${formatTime(deliveryTimeStart)} - ${formatTime(deliveryTimeEnd)}`,
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          showCountdown: true,
          countdownLabel: 'Time overdue:'
        };
      default:
        return {
          title: 'Scheduled Delivery',
          subtitle: `${formatTime(deliveryTimeStart)} - ${formatTime(deliveryTimeEnd)}`,
          bgColor: 'bg-orange-50 border-orange-200',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
          showCountdown: true,
          countdownLabel: 'Time until delivery:'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          {timeRemaining.status === 'active' ? 
            <Clock className="w-5 h-5" /> : 
            <Calendar className="w-5 h-5" />
          }
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm ${config.textColor}`}>
            {config.title}
          </h3>
          <p className={`text-xs mt-1 ${config.textColor} opacity-80`}>
            {config.subtitle}
            {isFlexible && timeRemaining.status !== 'passed' && (
              <span className="ml-2 px-2 py-1 bg-white/50 rounded text-xs">
                Flexible time
              </span>
            )}
          </p>
          
          {config.showCountdown && (
            <div className="mt-3">
              <p className={`text-xs font-medium ${config.textColor} mb-2`}>
                {config.countdownLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {timeRemaining.days > 0 && (
                  <div className="text-center">
                    <div className={`text-lg font-bold ${config.textColor}`}>
                      {timeRemaining.days}
                    </div>
                    <div className={`text-xs ${config.textColor} opacity-70`}>
                      {timeRemaining.days === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                )}
                {(timeRemaining.days > 0 || timeRemaining.hours > 0) && (
                  <div className="text-center">
                    <div className={`text-lg font-bold ${config.textColor}`}>
                      {timeRemaining.hours}
                    </div>
                    <div className={`text-xs ${config.textColor} opacity-70`}>
                      {timeRemaining.hours === 1 ? 'hour' : 'hours'}
                    </div>
                  </div>
                )}
                <div className="text-center">
                  <div className={`text-lg font-bold ${config.textColor}`}>
                    {timeRemaining.minutes}
                  </div>
                  <div className={`text-xs ${config.textColor} opacity-70`}>
                    {timeRemaining.minutes === 1 ? 'min' : 'mins'}
                  </div>
                </div>
                {timeRemaining.status === 'active' && (
                  <div className="text-center">
                    <div className={`text-lg font-bold ${config.textColor}`}>
                      {timeRemaining.seconds}
                    </div>
                    <div className={`text-xs ${config.textColor} opacity-70`}>
                      sec
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};