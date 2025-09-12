import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";

interface DaysSelectorProps {
  selectedDays?: string[];
  onDaysChange: (days: string[]) => void;
  disabled?: boolean;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday", short: "Mon" },
  { value: "tuesday", label: "Tuesday", short: "Tue" },
  { value: "wednesday", label: "Wednesday", short: "Wed" },
  { value: "thursday", label: "Thursday", short: "Thu" },
  { value: "friday", label: "Friday", short: "Fri" },
  { value: "saturday", label: "Saturday", short: "Sat" },
  { value: "sunday", label: "Sunday", short: "Sun" },
];

export function DaysSelector({
  selectedDays = [],
  onDaysChange,
  disabled = false,
}: DaysSelectorProps) {
  const safeDays = React.useMemo(() => {
    return Array.isArray(selectedDays) ? selectedDays : [];
  }, [selectedDays]);

  const handleDayToggle = React.useCallback((day: string, checked: boolean) => {
    if (disabled || !onDaysChange) return;
    
    try {
      if (checked) {
        if (!safeDays.includes(day)) {
          onDaysChange([...safeDays, day]);
        }
      } else {
        onDaysChange(safeDays.filter((d) => d !== day));
      }
    } catch (error) {
      console.error('Error toggling day selection:', error);
    }
  }, [safeDays, onDaysChange, disabled]);

  const handleSelectAll = React.useCallback(() => {
    if (disabled || !onDaysChange) return;
    
    try {
      if (safeDays.length === DAYS_OF_WEEK.length) {
        onDaysChange([]);
      } else {
        onDaysChange(DAYS_OF_WEEK.map((day) => day.value));
      }
    } catch (error) {
      console.error('Error in select all operation:', error);
    }
  }, [safeDays.length, onDaysChange, disabled]);

  const allSelected = safeDays.length === DAYS_OF_WEEK.length;
  const noneSelected = safeDays.length === 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-4 h-4" />
          Applicable Days
          {noneSelected && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              All Days
            </span>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select specific days when this promotion is active. Leave empty for all days.
        </p>
      </CardHeader>
      <CardContent className="p-3 md:p-6">
        <div className="text-sm text-muted-foreground">
          Day selection temporarily disabled
        </div>
      </CardContent>
    </Card>
  );
}