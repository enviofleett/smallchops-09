import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, TrendingUp, Clock, CheckCircle, AlertCircle, Activity, BarChart3, MousePointer } from 'lucide-react';
import { cn } from '@/lib/utils';

import { OrderStatus } from '@/types/orders';

type OrderCategory = 'all' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'overdue';

interface StatCard {
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  textColor: string;
  category: OrderCategory;
  description?: string;
}

interface AdminOrdersStatsProps {
  orders: any[];
  overdueOrders: any[];
  activeTab: string;
  showDeliveryReport: boolean;
  setShowDeliveryReport: (show: boolean) => void;
  onCategoryClick: (category: OrderCategory) => void;
  isLoading?: boolean;
}

export function AdminOrdersStats({
  orders,
  overdueOrders,
  activeTab,
  showDeliveryReport,
  setShowDeliveryReport,
  onCategoryClick,
  isLoading = false
}: AdminOrdersStatsProps) {
  // Calculate comprehensive order counts by status
  const orderCounts = {
    all: orders.length,
    confirmed: orders.filter(o => o.status === 'confirmed' && o.payment_status === 'paid').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    overdue: overdueOrders.length
  };

  const statCards: StatCard[] = [
    {
      title: 'Total Orders',
      value: orderCounts.all,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      category: 'all',
      description: 'All orders in the system'
    },
    {
      title: 'Confirmed',
      value: orderCounts.confirmed,
      icon: CheckCircle,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      category: 'confirmed',
      description: 'Orders confirmed and paid'
    },
    {
      title: 'Preparing',
      value: orderCounts.preparing,
      icon: Activity,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      category: 'preparing',
      description: 'Orders being prepared'
    },
    {
      title: 'Ready',
      value: orderCounts.ready,
      icon: Clock,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      category: 'ready',
      description: 'Orders ready for pickup/delivery'
    },
    {
      title: 'Out for Delivery',
      value: orderCounts.out_for_delivery,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      category: 'out_for_delivery',
      description: 'Orders currently being delivered'
    },
    {
      title: 'Overdue',
      value: orderCounts.overdue,
      icon: AlertCircle,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      category: 'overdue',
      description: 'Orders past their delivery time'
    }
  ];

  const handleCardClick = (category: OrderCategory) => {
    if (isLoading) return;
    onCategoryClick(category);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Production-Ready Order Stats with Click Functionality */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            const isActive = activeTab === stat.category;
            const hasOrders = stat.value > 0;
            
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Card 
                    className={cn(
                      "relative cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105",
                      isActive && "ring-2 ring-primary shadow-lg",
                      !hasOrders && "opacity-60",
                      isLoading && "cursor-not-allowed opacity-50"
                    )}
                    onClick={() => handleCardClick(stat.category)}
                  >
                    <CardContent className="p-4">
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                      )}
                      
                      {/* Loading overlay */}
                      {isLoading && (
                        <div className="absolute inset-0 bg-background/50 rounded-md flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            {stat.title}
                          </p>
                          <div className="flex items-baseline gap-2">
                            <p className={cn("text-2xl font-bold", stat.textColor)}>
                              {stat.value}
                            </p>
                            {hasOrders && !isLoading && (
                              <MousePointer className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="ml-2">
                          <Icon className={cn("h-8 w-8", stat.textColor)} />
                        </div>
                      </div>

                      {/* Click hint */}
                      {hasOrders && !isLoading && (
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{stat.description}</p>
                  {hasOrders && !isLoading && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Click to filter orders
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

      {/* Enhanced Status Display and Controls */}
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm font-medium">
            {activeTab === 'all' ? 'All Orders' : 
             activeTab === 'confirmed' ? 'Confirmed Orders' :
             activeTab === 'overdue' ? 'Overdue Orders' :
             `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('_', ' ')} Orders`}
          </Badge>
          <div className="text-sm text-muted-foreground">
            {activeTab === 'all' 
              ? `${orders.length} total orders`
              : `${orderCounts[activeTab as keyof typeof orderCounts]} orders`}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Refresh indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          )}
          
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
      </div>
    </TooltipProvider>
  );
}