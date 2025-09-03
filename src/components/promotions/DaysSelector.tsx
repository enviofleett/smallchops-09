import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";

interface DaysSelectorProps {
  selectedDays: string[];
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
  // PRODUCTION: Simple, direct state management without local state
  const safeSelectedDays = React.useMemo(() => selectedDays || [], [selectedDays]);

  // PRODUCTION: Direct day toggle handler - no debouncing, no local state
  const handleDayToggle = React.useCallback((day: string, checked: boolean) => {
    if (disabled) return;
    
    try {
      const newDays = checked 
        ? safeSelectedDays.includes(day) ? safeSelectedDays : [...safeSelectedDays, day]
        : safeSelectedDays.filter((d) => d !== day);
      
      onDaysChange(newDays);
    } catch (error) {
      console.error('Error toggling day selection:', error);
    }
  }, [onDaysChange, disabled, safeSelectedDays]);

  // PRODUCTION: Direct select all handler
  const handleSelectAll = React.useCallback(() => {
    if (disabled) return;
    
    try {
      const newDays = safeSelectedDays.length === DAYS_OF_WEEK.length 
        ? [] 
        : DAYS_OF_WEEK.map((day) => day.value);
      
      onDaysChange(newDays);
    } catch (error) {
      console.error('Error in select all operation:', error);
    }
  }, [onDaysChange, disabled, safeSelectedDays]);

  // PRODUCTION: Simple keyboard navigation
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent, day: string) => {
    if (disabled) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const isSelected = safeSelectedDays.includes(day);
      handleDayToggle(day, !isSelected);
    }
  }, [handleDayToggle, disabled, safeSelectedDays]);

  // PRODUCTION: Simple computed values
  const allSelected = safeSelectedDays.length === DAYS_OF_WEEK.length;
  const noneSelected = safeSelectedDays.length === 0;

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
      <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6">
        {/* PRODUCTION: Accessibility enhancement */}
        <div id="days-selection-label" className="sr-only">
          Select applicable days for this promotion
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              disabled={disabled}
            />
            <Label htmlFor="select-all" className="text-sm font-medium">
              {allSelected ? "Deselect All" : "Select All Days"}
            </Label>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {safeSelectedDays.length === 0
              ? "Active every day"
              : `Active ${safeSelectedDays.length} day${safeSelectedDays.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* PRODUCTION: Enhanced day selection grid with proper accessibility */}
        <div 
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 md:gap-3"
          role="group"
          aria-labelledby="days-selection-label"
        >
        {DAYS_OF_WEEK.map((day) => {
          const isSelected = safeSelectedDays.includes(day.value);
          return (
            <div
              key={day.value}
              className={`
                flex items-center gap-2 p-2 md:p-3 rounded-lg border transition-colors
                ${
                  isSelected
                    ? "bg-primary/5 border-primary/30"
                    : "bg-muted/50 border-border hover:border-primary/30"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/70"}
              `}
              onClick={(e) => {
                e.preventDefault();
                if (!disabled) {
                  handleDayToggle(day.value, !isSelected);
                }
              }}
            >
              <Checkbox
                id={`day-${day.value}`}
                checked={isSelected}
                onCheckedChange={(checked) => {
                  if (!disabled) {
                    handleDayToggle(day.value, !!checked);
                  }
                }}
                disabled={disabled}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{day.short}</span>
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {day.label}
                </span>
              </div>
            </div>
          );
        })}
        </div>

        {safeSelectedDays.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Active on:</strong>{" "}
              {DAYS_OF_WEEK
                .filter((day) => safeSelectedDays.includes(day.value))
                .map((day) => day.label)
                .join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}