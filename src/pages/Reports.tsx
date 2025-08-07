import React, { useEffect } from "react";
import { Download, Calendar, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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

  // Fetch analytics from API via react-query
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports/analytics"],
    queryFn: () => fetchReportsData(3), // Pass retry count as argument
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
    
    const csvContent = csvData.map(row => row.join(',')).join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reports.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // KPIs mapping for grid
  const kpiData = data
    ? [
        {
          label: "Today's Revenue",
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
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Reports & Analytics
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Comprehensive business insights and performance metrics
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
            <Calendar className="h-4 w-4" />
            <span>Last 30 days</span>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            
            <Button
              onClick={() => window.print()}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <KpiSkeletons />
        ) : (
          kpiData.map((kpi, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.label}
                  </CardTitle>
                   <div className={`p-2 rounded-md ${kpi.iconClass}`}>
                     {typeof kpi.icon === 'function' ? <kpi.icon className="h-4 w-4" /> : kpi.icon}
                   </div>
                </div>
                 <div className="space-y-1">
                   <div className="text-2xl font-bold">{kpi.value}</div>
                 </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueBreakdown data={data} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-1">
          <ReportTabs reportsData={data} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
