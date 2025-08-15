
import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RevenueBarChart from "@/components/charts/RevenueBarChart";

/**
 * Accepts reportsData and passes to chart components.
 * For early phase, only RevenueBarChart, but can extend for orders, popular items etc.
 */
export default function ReportTabs({ reportsData, isLoading }: {
  reportsData?: any,
  isLoading?: boolean,
}) {
  return (
    <Tabs defaultValue="revenue" className="w-full">
      <TabsList className="gap-2 bg-gray-50 p-1 rounded-lg mb-3">
        <TabsTrigger value="revenue">Revenue Chart</TabsTrigger>
        <TabsTrigger value="orders">Order Trends</TabsTrigger>
        <TabsTrigger value="popular">Popular Items</TabsTrigger>
      </TabsList>
      <TabsContent value="revenue" className="p-0">
        <div>
          <div className="mb-1 text-lg font-bold text-gray-800">
            Revenue Trends
          </div>
          <div className="mb-2 text-gray-500 text-sm">
            Daily revenue for the past week
          </div>
          <RevenueBarChart data={reportsData?.revenueSeries} isLoading={isLoading} />
        </div>
      </TabsContent>
      <TabsContent value="orders" className="p-0">
        <div>
          <div className="mb-1 text-lg font-bold text-gray-800">
            Order Analytics
          </div>
          <div className="mb-2 text-gray-500 text-sm">
            Track order patterns and customer behavior
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {reportsData?.kpiStats?.ordersToday || 0}
              </div>
              <div className="text-sm text-blue-500 font-medium">Orders Today</div>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="popular" className="p-0">
        <div>
          <div className="mb-1 text-lg font-bold text-gray-800">
            Product Performance
          </div>
          <div className="mb-2 text-gray-500 text-sm">
            Analyze your best-selling products
          </div>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {reportsData?.stats?.totalProducts || 7}
              </div>
              <div className="text-sm text-green-500 font-medium">Total Products</div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
