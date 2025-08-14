import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Users } from 'lucide-react';
import { DeliveryTimeSlot } from '@/utils/deliveryScheduling';

interface TimeSlotSelectProps {
  slots: DeliveryTimeSlot[];
  selectedSlot?: DeliveryTimeSlot;
  onSelect: (slot: DeliveryTimeSlot) => void;
  className?: string;
  placeholder?: string;
}

export const TimeSlotSelect: React.FC<TimeSlotSelectProps> = ({
  slots,
  selectedSlot,
  onSelect,
  className = '',
  placeholder = 'Select delivery time'
}) => {
  const availableSlots = slots.filter(slot => slot.available);

  const formatSlotDisplay = (slot: DeliveryTimeSlot) => {
    const timeRange = `${slot.start_time} - ${slot.end_time}`;
    const spotsLeft = slot.available_spots || 0;
    return `${timeRange} (${spotsLeft} spots left)`;
  };

  const getSlotValue = (slot: DeliveryTimeSlot) => {
    return `${slot.start_time}-${slot.end_time}`;
  };

  const selectedValue = selectedSlot ? getSlotValue(selectedSlot) : '';

  if (availableSlots.length === 0) {
    return (
      <div className={`p-4 border border-dashed border-muted-foreground/25 rounded-lg text-center ${className}`}>
        <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No delivery slots available for this date</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <Select value={selectedValue} onValueChange={(value) => {
        const [startTime, endTime] = value.split('-');
        const slot = availableSlots.find(s => s.start_time === startTime && s.end_time === endTime);
        if (slot) onSelect(slot);
      }}>
        <SelectTrigger className="w-full h-auto min-h-[56px] px-4 py-3 border-2 hover:border-primary/50 transition-colors">
          <SelectValue placeholder={placeholder}>
            {selectedSlot && (
              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center gap-2 text-primary">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">
                    {selectedSlot.start_time} - {selectedSlot.end_time}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                  <Users className="h-3 w-3" />
                  <span>{selectedSlot.available_spots || 0} spots left</span>
                </div>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px] bg-background border-2">
          {availableSlots.map((slot, index) => {
            const spotsLeft = slot.available_spots || 0;
            const isLowAvailability = spotsLeft <= 5;
            
            return (
              <SelectItem
                key={index}
                value={getSlotValue(slot)}
                className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {slot.start_time} - {slot.end_time}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={isLowAvailability ? "destructive" : "secondary"}
                      className="text-xs font-medium"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {spotsLeft} left
                    </Badge>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      
      {/* Capacity Legend */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-secondary"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive"></div>
            <span>Low availability</span>
          </div>
        </div>
        <span>{availableSlots.length} slots available</span>
      </div>
    </div>
  );
};