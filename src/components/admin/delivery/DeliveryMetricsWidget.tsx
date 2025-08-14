import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Clock, 
  Truck, 
  CheckCircle,
  AlertCircle,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { PriceDisplay } from '@/components/ui/price-display';

interface DeliveryMetrics {
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  outForDelivery: number;
  completedOrders: number;
  urgentOrders: number;
  totalRevenue: number;
  onTimeDeliveryRate?: number;
  avgDeliveryTime?: number;
}

interface DeliveryMetricsWidgetProps {
  metrics: DeliveryMetrics;
  isLoading: boolean;
  className?: string;
}

export function DeliveryMetricsWidget({ metrics, isLoading, className }: DeliveryMetricsWidgetProps) {
  const metricCards = [
    {
      title: 'Total Orders',
      value: metrics.totalOrders,
      icon: Package,
      color: 'bg-blue-100 text-blue-600',
      description: 'All delivery orders'
    },
    {
      title: 'Pending',
      value: metrics.pendingOrders,
      icon: Clock,
      color: 'bg-orange-100 text-orange-600',
      description: 'Awaiting preparation'
    },
    {
      title: 'Preparing',
      value: metrics.preparingOrders,
      icon: Package,
      color: 'bg-yellow-100 text-yellow-600',
      description: 'Being prepared'
    },
    {
      title: 'Out for Delivery',
      value: metrics.outForDelivery,
      icon: Truck,
      color: 'bg-purple-100 text-purple-600',
      description: 'En route to customer'
    },
    {
      title: 'Completed',
      value: metrics.completedOrders,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
      description: 'Successfully delivered'
    },
    {
      title: 'Urgent',
      value: metrics.urgentOrders,
      icon: AlertCircle,
      color: 'bg-red-100 text-red-600',
      description: 'Due within 2 hours'
    },
    {
      title: 'Revenue',
      value: metrics.totalRevenue,
      icon: DollarSign,
      color: 'bg-green-100 text-green-600',
      description: 'Total delivery revenue',
      isPrice: true
    }
  ];

  if (isLoading) {
    return (
      <div className={`grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 ${className}`}>
        {metricCards.map((card, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.color} opacity-50`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="h-3 bg-muted rounded w-12 mb-1"></div>
                  <div className="h-5 bg-muted rounded w-8"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 ${className}`}>
      {metricCards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.title}</p>
                <div className="text-lg font-bold">
                  {card.isPrice ? (
                    <PriceDisplay 
                      originalPrice={card.value} 
                      size="sm"
                      className="text-green-600"
                    />
                  ) : (
                    card.value
                  )}
                </div>
              </div>
            </div>
            {/* Performance indicators */}
            {card.title === 'Urgent' && card.value > 0 && (
              <Badge variant="destructive" className="mt-2 text-xs">
                Needs attention
              </Badge>
            )}
            {card.title === 'Out for Delivery' && card.value > 10 && (
              <Badge variant="outline" className="mt-2 text-xs">
                High volume
              </Badge>
            )}
          </CardContent>
        </Card>
      ))}
      
      {/* Additional performance metrics */}
      {(metrics.onTimeDeliveryRate !== undefined || metrics.avgDeliveryTime !== undefined) && (
        <Card className="xl:col-span-7 lg:col-span-4 col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Performance</span>
              </div>
              <div className="flex gap-4 text-sm">
                {metrics.onTimeDeliveryRate !== undefined && (
                  <div className="text-center">
                    <p className="text-muted-foreground">On-time Rate</p>
                    <p className="font-semibold text-lg">{metrics.onTimeDeliveryRate.toFixed(1)}%</p>
                  </div>
                )}
                {metrics.avgDeliveryTime !== undefined && (
                  <div className="text-center">
                    <p className="text-muted-foreground">Avg. Time</p>
                    <p className="font-semibold text-lg">{metrics.avgDeliveryTime}m</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}