
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Truck, MapPin } from 'lucide-react';
import FulfillmentChart from '@/components/charts/FulfillmentChart';
import { useFulfillmentStats } from '@/hooks/useFulfillmentStats';

export const FulfillmentWeeklyStats = () => {
  const { data, isLoading, error } = useFulfillmentStats();

  // Calculate summary statistics
  const totalDeliveries = data.reduce((sum, week) => sum + week.delivery, 0);
  const totalPickups = data.reduce((sum, week) => sum + week.pickup, 0);
  const totalOrders = totalDeliveries + totalPickups;
  
  const deliveryPercentage = totalOrders > 0 ? Math.round((totalDeliveries / totalOrders) * 100) : 0;
  const pickupPercentage = totalOrders > 0 ? Math.round((totalPickups / totalOrders) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Weekly Fulfillment Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
            <Truck className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-600">Delivery Orders</p>
              <p className="text-2xl font-bold text-blue-700">{totalDeliveries}</p>
              <p className="text-xs text-blue-500">{deliveryPercentage}% of total</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
            <MapPin className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-600">Pickup Orders</p>
              <p className="text-2xl font-bold text-green-700">{totalPickups}</p>
              <p className="text-xs text-green-500">{pickupPercentage}% of total</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <TrendingUp className="h-8 w-8 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-700">{totalOrders}</p>
              <p className="text-xs text-gray-500">Last 6 weeks</p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Weekly Breakdown</h4>
          {error ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="text-red-500 text-sm">Failed to load fulfillment data</div>
                <div className="text-red-400 text-xs mt-1">{error}</div>
              </div>
            </div>
          ) : (
            <FulfillmentChart data={data} isLoading={isLoading} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
