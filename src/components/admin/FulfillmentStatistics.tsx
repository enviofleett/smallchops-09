import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Truck, MapPin } from 'lucide-react';
import { FulfillmentStats } from '@/hooks/useAdminDashboardData';

interface FulfillmentStatisticsProps {
  stats: FulfillmentStats;
  isLoading?: boolean;
}

export const FulfillmentStatistics: React.FC<FulfillmentStatisticsProps> = ({
  stats,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fulfillment Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-2 bg-muted rounded"></div>
            </div>
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-2 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Fulfillment Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats.total_fulfillment_orders === 0 ? (
          <div className="text-center py-8">
            <Truck className="mx-auto h-12 w-12 opacity-50 mb-4" />
            <p className="text-muted-foreground">No fulfillment data available</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Total Orders Summary */}
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{stats.total_fulfillment_orders.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Orders</p>
            </div>

            {/* Delivery Statistics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">Delivery Orders</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{stats.delivery_orders.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({stats.delivery_percentage}%)
                  </span>
                </div>
              </div>
              <Progress 
                value={stats.delivery_percentage} 
                className="h-2"
              />
            </div>

            {/* Pickup Statistics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Pickup Orders</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{stats.pickup_orders.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({stats.pickup_percentage}%)
                  </span>
                </div>
              </div>
              <Progress 
                value={stats.pickup_percentage} 
                className="h-2"
              />
            </div>

            {/* Summary Insights */}
            <div className="pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-lg font-semibold text-blue-600">
                    {stats.delivery_percentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">Prefer Delivery</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-green-600">
                    {stats.pickup_percentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">Prefer Pickup</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};