import React, { useEffect, useState } from "react";
import { Download, Calendar, Printer, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import ReportTabs from "@/components/ReportTabs";
import { RevenueBreakdown } from "@/components/reports/RevenueBreakdown";
import { fetchReportsData } from "@/api/reports";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorHandler } from "@/hooks/useErrorHandler";


// Dynamic icon/color logic has to remain for each KPI type
const kpiIconClasses = [
  "bg-teal-100 text-teal-600",
  "bg-blue-100 text-blue-600",
  "bg-lime-100 text-lime-600",
  "bg-orange-100 text-orange-600",
];

// Render skeleton state for KPI cards (while loading)
function KpiSkeletons() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {[...Array(4)].map((_, idx) => (
        <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 flex flex-col gap-3">
          <div className="rounded-xl flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-gray-100" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-1" />
          <div className="h-5 md:h-6 bg-gray-100 rounded w-1/2 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const { handleError } = useErrorHandler();

  // State for filters
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('week');
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Fetch analytics from API via react-query
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports/analytics", groupBy, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]],
    queryFn: () => fetchReportsData({ 
      groupBy, 
      startDate: startDate.toISOString().split('T')[0], 
      endDate: endDate.toISOString().split('T')[0],
      retryCount: 3 
    }),
    staleTime: 2 * 60 * 1000, // 2min cache for live data
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes for live updates
    retry: false // Disable react-query retry since fetchReportsData handles its own retry logic
  });

  // Fix: Call error handler only when error changes, not on every render
  useEffect(() => {
    if (error) {
      handleError(error, "Reports Page");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]); // Only run when error changes

  const exportToCSV = () => {
    if (!data) return;
    
    const csvData = [
      ['Metric', 'Value'],
      ['Total Revenue', data.stats?.totalRevenue || 0],
      ['Total Orders', data.stats?.totalOrders || 0],
      ['Total Products', data.stats?.totalProducts || 0],
      ['Total Customers', data.stats?.totalCustomers || 0],
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateRange = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;
    a.download = `reports_${groupBy}_${dateRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Helper function to render icons safely
  const renderIcon = (icon: LucideIcon | React.ReactElement) => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as LucideIcon;
    return <IconComponent className="h-4 w-4" />;
  };

  // KPIs mapping for grid
  const kpiData = data
    ? [
        {
          label: "Total Revenue",
          value: data.stats?.totalRevenue !== undefined ? 
            (data.stats.totalRevenue === 0 ? "₦0" : 
              new Intl.NumberFormat('en-NG', { 
                style: 'currency', 
                currency: 'NGN',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0 
              }).format(data.stats.totalRevenue)
            ) : "-",
          sub: "",
          icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="M6 15l6-6 6 6" />
            </svg>
          ),
          iconClass: kpiIconClasses[0],
        },
        {
          label: "Total Orders",
          value: data.stats?.totalOrders !== undefined ? data.stats.totalOrders : "-",
          sub: "",
          icon: Download,
          iconClass: kpiIconClasses[1],
        },
        {
          label: "Total Products",
          value: data.stats?.totalProducts !== undefined ? data.stats.totalProducts : "-",
          sub: "",
          icon: Calendar,
          iconClass: kpiIconClasses[2],
        },
        {
          label: "Total Customers",
          value: data.stats?.totalCustomers !== undefined ? data.stats.totalCustomers : "-",
          sub: "",
          icon: Printer,
          iconClass: kpiIconClasses[3],
        },
      ]
    : [];

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8 px-3 md:px-4 lg:px-0">
      {/* Header */}
      <div className="flex flex-col space-y-3 md:space-y-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
        <div className="space-y-1 md:space-y-2">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            Reports & Analytics
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
            Comprehensive business insights and performance metrics
          </p>
        </div>
        
        <div className="flex flex-col gap-3 lg:gap-4">
          {/* Time Period Filter */}
          <div className="w-full lg:w-auto">
            <Select value={groupBy} onValueChange={(value: 'week' | 'month') => setGroupBy(value)}>
              <SelectTrigger className="w-full lg:w-[140px] h-10 text-sm">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:flex lg:gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full lg:w-auto justify-start text-left font-normal h-10 text-sm",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full lg:w-auto justify-start text-left font-normal h-10 text-sm",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">
                    {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  initialFocus
                  disabled={(date) => date < startDate}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-2 h-10 text-sm"
            >
              <Download className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            
            <Button
              onClick={() => window.print()}
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-2 h-10 text-sm"
            >
              <Printer className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Print</span>
              <span className="sm:hidden">Print</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-3 md:gap-4 lg:gap-6 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, idx) => (
              <Card key={idx} className="overflow-hidden">
                <CardContent className="p-3 md:p-4 lg:p-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-6 md:h-8 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : kpiData.length > 0 ? (
          kpiData.map((kpi, index) => (
            <Card key={index} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-3 md:p-4 lg:p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground line-clamp-2">
                    {kpi.label}
                  </CardTitle>
                   <div className={`p-1.5 md:p-2 rounded-md ${kpi.iconClass} flex-shrink-0`}>
                     {renderIcon(kpi.icon)}
                   </div>
                </div>
                 <div className="space-y-1">
                   <div className="text-lg md:text-xl lg:text-2xl font-bold leading-tight break-all">
                     {kpi.value}
                   </div>
                 </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-6 md:py-8">
            <p className="text-sm md:text-base text-muted-foreground">No data available for the selected period</p>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 xl:grid-cols-3">
        <div className="xl:col-span-2 order-2 xl:order-1">
          <RevenueBreakdown data={data} isLoading={isLoading} />
        </div>
        <div className="xl:col-span-1 order-1 xl:order-2">
          <ReportTabs reportsData={data} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
