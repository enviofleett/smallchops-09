
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
          <RevenueBarChart data={reportsData?.revenueTrends} isLoading={isLoading} />
        </div>
      </TabsContent>
      <TabsContent value="orders" className="p-0">
        {/* TODO: Wire up real order trends data */}
        <div className="text-gray-500 text-sm py-8 text-center">
          Order Trends coming soon.
        </div>
      </TabsContent>
      <TabsContent value="popular" className="p-0">
        {/* TODO: Display popular items (pass data to subcomponent) */}
        <div className="text-gray-500 text-sm py-8 text-center">
          Popular Items coming soon.
        </div>
      </TabsContent>
    </Tabs>
  );
}
