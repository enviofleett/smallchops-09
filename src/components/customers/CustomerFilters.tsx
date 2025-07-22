
import React from 'react';
import { CalendarDays, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRange } from '@/types/customers';

interface CustomerFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export const CustomerFilters = ({ dateRange, onDateRangeChange }: CustomerFiltersProps) => {
  const presetRanges = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'Last 6 months', days: 180 },
    { label: 'Last year', days: 365 },
  ];

  const handlePresetClick = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onDateRangeChange({ from, to });
  };

  const formatDateRange = () => {
    return `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CalendarDays className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <span className="text-sm text-gray-600">{formatDateRange()}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {presetRanges.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(preset.days)}
              className="text-xs"
            >
              {preset.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>More Filters</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
