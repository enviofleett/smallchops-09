import React, { useEffect } from "react";
import { Download, FileText } from "lucide-react";
import ReportTabs from "@/components/ReportTabs";
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, idx) => (
        <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3">
          <div className="rounded-xl flex items-center justify-center w-12 h-12 bg-gray-100" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-1" />
          <div className="h-6 bg-gray-100 rounded w-1/2 mb-1" />
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
    staleTime: 3 * 60 * 1000, // 3min cache
    retry: false // Disable react-query retry since fetchReportsData handles its own retry logic
  });

  // Fix: Call error handler only when error changes, not on every render
  useEffect(() => {
    if (error) {
      handleError(error, "Reports Page");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]); // Only run when error changes

  // KPIs mapping for grid
  const kpiData = data
    ? [
        {
          label: "Today's Revenue",
          value: data.kpiStats?.todaysRevenue !== undefined ? `₦${Number(data.kpiStats.todaysRevenue).toLocaleString()}` : "-",
          sub: "",
          icon: (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="M6 15l6-6 6 6" />
            </svg>
          ),
          className: kpiIconClasses[0],
        },
        {
          label: "Orders Today",
          value: data.kpiStats?.ordersToday !== undefined ? data.kpiStats.ordersToday : "-",
          sub: "",
          icon: (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M16 3v4a1 1 0 001 1h4" />
            </svg>
          ),
          className: kpiIconClasses[1],
        },
        {
          label: "Pending Orders",
          value: data.kpiStats?.pendingOrders !== undefined ? data.kpiStats.pendingOrders : "-",
          sub: "",
          icon: (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ),
          className: kpiIconClasses[2],
        },
        {
          label: "Completed Orders",
          value: data.kpiStats?.completedOrders !== undefined ? data.kpiStats.completedOrders : "-",
          sub: "",
          icon: (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 12 15 15 12" />
            </svg>
          ),
          className: kpiIconClasses[3],
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800">
            Reports & Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            Track your business performance and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Weekly Dropdown */}
          <select
            className="rounded-xl px-4 py-2 bg-gray-100 border border-gray-200 text-teal-700 font-medium focus:outline-none"
            defaultValue="weekly"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
          {/* Export Buttons */}
          <button className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition text-sm">
            <FileText className="w-4 h-4" /> Export CSV
          </button>
          <button className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition text-sm">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>
      {/* KPI Cards */}
      {isLoading ? (
        <KpiSkeletons />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiData.map((kpi, i) => (
            <div
              key={kpi.label}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3"
            >
              <div className={`rounded-xl flex items-center justify-center w-12 h-12 ${kpi.className}`}>
                {kpi.icon}
              </div>
              <div className="text-sm text-gray-500 font-semibold">{kpi.label}</div>
              <div className="text-2xl font-bold text-gray-800">{kpi.value}</div>
              {/* Optionally add sub: Not implemented yet in get_dashboard_data, left empty. */}
            </div>
          ))}
        </div>
      )}

      {/* Chart & Tabs Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <ReportTabs reportsData={data} isLoading={isLoading} />
      </div>
    </div>
  );
}
