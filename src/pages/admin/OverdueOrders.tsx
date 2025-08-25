import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertTriangle, 
  Clock,
  Package,
  RefreshCw,
  Bell,
  ArrowUp,
  Users
} from 'lucide-react';
import { useOverdueOrdersLogic } from '@/hooks/useOverdueOrdersLogic';
import { CountdownTimer } from '@/components/orders/CountdownTimer';
import { formatAddress } from '@/utils/formatAddress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function OverdueOrders() {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  const {
    overdueOrders,
    overdueStats,
    isLoading,
    escalateOrderMutation,
    notifyCustomerMutation,
    bulkUpdateStatusMutation,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    alertsEnabled,
    setAlertsEnabled,
    isProcessing,
    getCriticalOrders,
    getModerateOrders,
    getRecentOverdueOrders
  } = useOverdueOrdersLogic();

  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'critical':
        return getCriticalOrders();
      case 'moderate':
        return getModerateOrders();
      case 'recent':
        return getRecentOverdueOrders();
      default:
        return overdueOrders;
    }
  };

  const filteredOrders = getFilteredOrders();

  const handleBulkEscalate = async () => {
    if (selectedOrders.length === 0) return;
    
    try {
      await bulkUpdateStatusMutation.mutateAsync(selectedOrders);
      setSelectedOrders([]);
      toast.success(`${selectedOrders.length} orders escalated to READY status`);
    } catch (error) {
      console.error('Bulk escalation failed:', error);
    }
  };

  const handleNotifyCustomer = async (orderId: string) => {
    const order = overdueOrders.find(o => o.id === orderId);
    if (!order) return;

    const message = `We apologize for the delay with your order ${order.order_number}. We're working to get it delivered as soon as possible.`;
    
    try {
      await notifyCustomerMutation.mutateAsync({ orderId, message });
    } catch (error) {
      console.error('Customer notification failed:', error);
    }
  };

  const handleEscalateOrder = async (orderId: string) => {
    const order = overdueOrders.find(o => o.id === orderId);
    if (!order) return;

    const reason = `Order overdue by ${order.minutes_overdue} minutes`;
    
    try {
      await escalateOrderMutation.mutateAsync({ orderId, reason });
    } catch (error) {
      console.error('Order escalation failed:', error);
    }
  };

  return (
    <>
      <Helmet>
        <title>Overdue Orders - Admin Dashboard</title>
        <meta name="description" content="Monitor and manage overdue delivery orders" />
      </Helmet>

      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-destructive">Overdue Orders</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Monitor and manage orders that have exceeded their delivery time
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={autoRefreshEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", autoRefreshEnabled && "animate-spin")} />
              Auto Refresh
            </Button>
            <Button
              variant={alertsEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setAlertsEnabled(!alertsEnabled)}
            >
              <Bell className="w-4 h-4 mr-2" />
              Alerts
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border-destructive/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-destructive/10 text-destructive rounded-lg">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Overdue</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold text-destructive">
                    {overdueStats.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-300">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-red-100 text-red-700 rounded-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Critical</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold text-red-700">
                    {overdueStats.critical}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-300">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-orange-100 text-orange-700 rounded-lg">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Moderate</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold text-orange-700">
                    {overdueStats.moderate}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-300">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-yellow-100 text-yellow-700 rounded-lg">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Avg Delay</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold text-yellow-700">
                    {overdueStats.averageDelayMinutes}m
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        {selectedOrders.length > 0 && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    {selectedOrders.length} orders selected
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleBulkEscalate}
                    disabled={isProcessing}
                    size="sm"
                  >
                    <ArrowUp className="w-4 h-4 mr-2" />
                    Escalate All
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedOrders([])}
                    size="sm"
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="all">All ({overdueStats.total})</TabsTrigger>
            <TabsTrigger value="critical">Critical ({overdueStats.critical})</TabsTrigger>
            <TabsTrigger value="moderate">Moderate ({overdueStats.moderate})</TabsTrigger>
            <TabsTrigger value="recent">Recent ({overdueStats.recent})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <OverdueOrdersList 
              orders={filteredOrders}
              selectedOrders={selectedOrders}
              onSelectionChange={setSelectedOrders}
              onNotifyCustomer={handleNotifyCustomer}
              onEscalateOrder={handleEscalateOrder}
              isProcessing={isProcessing}
            />
          </TabsContent>

          <TabsContent value="critical" className="space-y-4">
            <OverdueOrdersList 
              orders={filteredOrders}
              selectedOrders={selectedOrders}
              onSelectionChange={setSelectedOrders}
              onNotifyCustomer={handleNotifyCustomer}
              onEscalateOrder={handleEscalateOrder}
              isProcessing={isProcessing}
            />
          </TabsContent>

          <TabsContent value="moderate" className="space-y-4">
            <OverdueOrdersList 
              orders={filteredOrders}
              selectedOrders={selectedOrders}
              onSelectionChange={setSelectedOrders}
              onNotifyCustomer={handleNotifyCustomer}
              onEscalateOrder={handleEscalateOrder}
              isProcessing={isProcessing}
            />
          </TabsContent>

          <TabsContent value="recent" className="space-y-4">
            <OverdueOrdersList 
              orders={filteredOrders}
              selectedOrders={selectedOrders}
              onSelectionChange={setSelectedOrders}
              onNotifyCustomer={handleNotifyCustomer}
              onEscalateOrder={handleEscalateOrder}
              isProcessing={isProcessing}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

interface OverdueOrdersListProps {
  orders: any[];
  selectedOrders: string[];
  onSelectionChange: (selected: string[]) => void;
  onNotifyCustomer: (orderId: string) => void;
  onEscalateOrder: (orderId: string) => void;
  isProcessing: boolean;
}

function OverdueOrdersList({
  orders,
  selectedOrders,
  onSelectionChange,
  onNotifyCustomer,
  onEscalateOrder,
  isProcessing
}: OverdueOrdersListProps) {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(orders.map(order => order.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedOrders, orderId]);
    } else {
      onSelectionChange(selectedOrders.filter(id => id !== orderId));
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No overdue orders</h3>
          <p className="text-muted-foreground">
            All orders are on track or have been delivered.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Select All */}
      <div className="flex items-center gap-2 px-2">
        <Checkbox
          checked={selectedOrders.length === orders.length}
          onCheckedChange={handleSelectAll}
        />
        <span className="text-sm text-muted-foreground">
          Select all {orders.length} orders
        </span>
      </div>

      {/* Orders List */}
      <div className="grid gap-4">
        {orders.map((order) => (
          <OverdueOrderCard
            key={order.id}
            order={order}
            isSelected={selectedOrders.includes(order.id)}
            onSelect={(checked) => handleSelectOrder(order.id, checked)}
            onNotifyCustomer={() => onNotifyCustomer(order.id)}
            onEscalate={() => onEscalateOrder(order.id)}
            isProcessing={isProcessing}
          />
        ))}
      </div>
    </div>
  );
}

interface OverdueOrderCardProps {
  order: any;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onNotifyCustomer: () => void;
  onEscalate: () => void;
  isProcessing: boolean;
}

function OverdueOrderCard({
  order,
  isSelected,
  onSelect,
  onNotifyCustomer,
  onEscalate,
  isProcessing
}: OverdueOrderCardProps) {
  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bgColor: 'bg-red-50 border-red-200',
          badgeVariant: 'destructive' as const,
          text: 'Critical'
        };
      case 'moderate':
        return {
          bgColor: 'bg-orange-50 border-orange-200',
          badgeVariant: 'secondary' as const,
          text: 'Moderate'
        };
      default:
        return {
          bgColor: 'bg-yellow-50 border-yellow-200',
          badgeVariant: 'outline' as const,
          text: 'Recent'
        };
    }
  };

  const config = getSeverityConfig(order.overdue_severity);

  return (
    <Card className={cn("relative", config.bgColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="flex-shrink-0 mt-1"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm sm:text-base truncate">
                  {order.order_number}
                </p>
                <Badge variant={config.badgeVariant} className="text-xs">
                  {config.text}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {order.customer_name}
              </p>
              <p className="text-xs text-muted-foreground">
                Overdue by {order.minutes_overdue} minutes
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={onNotifyCustomer}
              disabled={isProcessing}
              className="text-xs h-7 px-2"
            >
              <Bell className="w-3 h-3 mr-1" />
              Notify
            </Button>
            <Button
              size="sm"
              onClick={onEscalate}
              disabled={isProcessing}
              className="text-xs h-7 px-2"
            >
              <ArrowUp className="w-3 h-3 mr-1" />
              Escalate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Order Details */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">₦{order.total_amount?.toLocaleString()}</span>
          </div>
          
          {/* Delivery Address */}
          {order.delivery_address && (
            <div className="text-xs">
              <p className="text-muted-foreground mb-1">Address:</p>
              <p className="break-words">
                {formatAddress(order.delivery_address)}
              </p>
            </div>
          )}

          {/* Countdown showing overdue time */}
          {order.delivery_schedule && (
            <CountdownTimer
              deliveryDate={order.delivery_schedule.delivery_date}
              deliveryTimeStart={order.delivery_schedule.delivery_time_start}
              deliveryTimeEnd={order.delivery_schedule.delivery_time_end}
              className="text-xs"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}