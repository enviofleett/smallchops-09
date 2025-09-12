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
      <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6">
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
            {safeDays.length === 0
              ? "Active every day"
              : `Active ${safeDays.length} day${safeDays.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 md:gap-3">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = safeDays.includes(day.value);
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
                onClick={() => {
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

        {safeDays.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Active on:</strong>{" "}
              {DAYS_OF_WEEK
                .filter((day) => safeDays.includes(day.value))
                .map((day) => day.label)
                .join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}