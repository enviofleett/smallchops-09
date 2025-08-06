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
  selectedDays,
  onDaysChange,
  disabled = false,
}: DaysSelectorProps) {
  const handleDayToggle = (day: string, checked: boolean) => {
    if (checked) {
      onDaysChange([...selectedDays, day]);
    } else {
      onDaysChange(selectedDays.filter((d) => d !== day));
    }
  };

  const handleSelectAll = () => {
    if (selectedDays.length === DAYS_OF_WEEK.length) {
      onDaysChange([]);
    } else {
      onDaysChange(DAYS_OF_WEEK.map((day) => day.value));
    }
  };

  const allSelected = selectedDays.length === DAYS_OF_WEEK.length;
  const noneSelected = selectedDays.length === 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
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
      <CardContent className="space-y-4">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = selectedDays.includes(day.value);
            return (
              <div
                key={day.value}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border transition-colors
                  ${
                    isSelected
                      ? "bg-primary/5 border-primary/30"
                      : "bg-muted/50 border-border hover:border-primary/30"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
                onClick={() => !disabled && handleDayToggle(day.value, !isSelected)}
              >
                <Checkbox
                  id={day.value}
                  checked={isSelected}
                  onCheckedChange={(checked) => handleDayToggle(day.value, !!checked)}
                  disabled={disabled}
                />
                <Label
                  htmlFor={day.value}
                  className={`
                    text-sm cursor-pointer select-none
                    ${disabled ? "cursor-not-allowed" : ""}
                  `}
                >
                  <span className="block font-medium">{day.short}</span>
                  <span className="block text-xs text-muted-foreground hidden sm:block">
                    {day.label}
                  </span>
                </Label>
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