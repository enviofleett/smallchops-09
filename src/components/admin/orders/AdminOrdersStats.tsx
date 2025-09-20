import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, TrendingUp, Clock, CheckCircle, AlertCircle, Activity, BarChart3 } from 'lucide-react';

interface AdminOrdersStatsProps {
  orders: any[];
  overdueOrders: any[];
  activeTab: string;
  showDeliveryReport: boolean;
  setShowDeliveryReport: (show: boolean) => void;
}

export function AdminOrdersStats({
  orders,
  overdueOrders,
  activeTab,
  showDeliveryReport,
  setShowDeliveryReport
}: AdminOrdersStatsProps) {
  // Calculate order counts by status
  const orderCounts = {
    all: orders.length,
    confirmed: orders.filter(o => o.status === 'confirmed' && o.payment_status === 'paid').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    overdue: overdueOrders.length
  };

  const statCards = [
    {
      title: 'Total Orders',
      value: orderCounts.all,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Confirmed',
      value: orderCounts.confirmed,
      icon: CheckCircle,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Preparing',
      value: orderCounts.preparing,
      icon: Activity,
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    },
    {
      title: 'Ready',
      value: orderCounts.ready,
      icon: Clock,
      color: 'bg-purple-500',
      textColor: 'text-purple-600'
    },
    {
      title: 'Out for Delivery',
      value: orderCounts.out_for_delivery,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600'
    },
    {
      title: 'Overdue',
      value: orderCounts.overdue,
      icon: AlertCircle,
      color: 'bg-red-500',
      textColor: 'text-red-600'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${stat.textColor}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delivery Report Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {activeTab === 'all' ? 'All Orders' : 
             activeTab === 'confirmed' ? 'Confirmed Orders' :
             activeTab === 'overdue' ? 'Overdue Orders' :
             `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Orders`}
          </Badge>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeliveryReport(!showDeliveryReport)}
          className="flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          {showDeliveryReport ? 'Hide Report' : 'Show Report'}
        </Button>
      </div>
    </div>
  );
}