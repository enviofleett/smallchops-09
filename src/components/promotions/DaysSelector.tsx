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
  // PRODUCTION: Enhanced day toggle with validation
  const handleDayToggle = React.useCallback((day: string, checked: boolean) => {
    try {
      if (disabled) return;
      
      if (checked) {
        // Prevent duplicates
        if (!selectedDays.includes(day)) {
          onDaysChange([...selectedDays, day]);
        }
      } else {
        onDaysChange(selectedDays.filter((d) => d !== day));
      }
    } catch (error) {
      console.error('Error toggling day selection:', error);
    }
  }, [selectedDays, onDaysChange, disabled]);

  // PRODUCTION: Enhanced select all with proper state management
  const handleSelectAll = React.useCallback(() => {
    try {
      if (disabled) return;
      
      if (selectedDays.length === DAYS_OF_WEEK.length) {
        onDaysChange([]);
      } else {
        onDaysChange(DAYS_OF_WEEK.map((day) => day.value));
      }
    } catch (error) {
      console.error('Error in select all operation:', error);
    }
  }, [selectedDays.length, onDaysChange, disabled]);

  // PRODUCTION: Keyboard navigation support
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent, day: string) => {
    if (disabled) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const isSelected = selectedDays.includes(day);
      handleDayToggle(day, !isSelected);
    }
  }, [selectedDays, handleDayToggle, disabled]);

  const allSelected = selectedDays.length === DAYS_OF_WEEK.length;
  const noneSelected = selectedDays.length === 0;

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
            {selectedDays.length === 0
              ? "Active every day"
              : `Active ${selectedDays.length} day${selectedDays.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* PRODUCTION: Enhanced day selection grid with proper accessibility */}
        <div 
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 md:gap-3"
          role="group"
          aria-labelledby="days-selection-label"
        >
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = selectedDays.includes(day.value);
            return (
              <div
                key={day.value}
                className={`
                  flex items-center gap-2 p-2 md:p-3 rounded-lg border transition-colors focus-within:ring-2 focus-within:ring-primary/50
                  ${
                    isSelected
                      ? "bg-primary/5 border-primary/30"
                      : "bg-muted/50 border-border hover:border-primary/30"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/70"}
                `}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-pressed={isSelected}
                aria-label={`${day.label} - ${isSelected ? 'selected' : 'not selected'}`}
                onKeyDown={(e) => handleKeyDown(e, day.value)}
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
                  tabIndex={-1} // Remove from tab order, parent handles focus
                  aria-hidden="true" // Hidden from screen readers, parent provides context
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

        {selectedDays.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Active on:</strong>{" "}
              {DAYS_OF_WEEK
                .filter((day) => selectedDays.includes(day.value))
                .map((day) => day.label)
                .join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}