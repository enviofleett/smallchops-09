import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface DailyMetric {
  date: string;
  revenue: number;
  orders: number;
  products_sold: number;
  customers: number;
  top_customers?: Array<{
    name: string;
    email: string;
    spending: number;
    orders: number;
  }>;
  order_details?: Array<{
    customer_name: string;
    customer_email: string;
    order_date: string;
    total_amount: number;
  }>;
}

interface CustomerInsightsProps {
  dailyMetrics?: DailyMetric[];
}

export function CustomerInsights({ dailyMetrics }: CustomerInsightsProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  // Calculate top customers across entire period
  const allTopCustomers = useMemo(() => {
    if (!dailyMetrics?.length) return [];

    const customerMap = new Map<string, { name: string; email: string; spending: number; orders: number }>();

    dailyMetrics.forEach(day => {
      day.top_customers?.forEach(customer => {
        const existing = customerMap.get(customer.email);
        if (existing) {
          existing.spending += customer.spending;
          existing.orders += customer.orders;
        } else {
          customerMap.set(customer.email, {
            name: customer.name,
            email: customer.email,
            spending: customer.spending,
            orders: customer.orders
          });
        }
      });
    });

    return Array.from(customerMap.values())
      .sort((a, b) => b.spending - a.spending)
      .slice(0, 10);
  }, [dailyMetrics]);

  // Calculate first-time customers for the period
  const firstTimeCustomers = useMemo(() => {
    if (!dailyMetrics?.length) return [];

    const customerFirstOrders = new Map<string, { name: string; email: string; firstOrderDate: string; spending: number }>();

    dailyMetrics.forEach(day => {
      day.order_details?.forEach(order => {
        if (!customerFirstOrders.has(order.customer_email)) {
          customerFirstOrders.set(order.customer_email, {
            name: order.customer_name,
            email: order.customer_email,
            firstOrderDate: order.order_date,
            spending: order.total_amount
          });
        } else {
          const existing = customerFirstOrders.get(order.customer_email)!;
          existing.spending += order.total_amount;
          if (order.order_date < existing.firstOrderDate) {
            existing.firstOrderDate = order.order_date;
          }
        }
      });
    });

    return Array.from(customerFirstOrders.values())
      .sort((a, b) => new Date(b.firstOrderDate).getTime() - new Date(a.firstOrderDate).getTime())
      .slice(0, 10);
  }, [dailyMetrics]);

  const selectedMetric = dailyMetrics && dailyMetrics.length > 0 ? dailyMetrics[selectedDayIndex] : null;

  if (!dailyMetrics?.length) {
    return null;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Top Customers for Selected Day */}
      {selectedMetric && Array.isArray(selectedMetric.top_customers) && selectedMetric.top_customers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Customers - {formatDate(selectedMetric.date)}</CardTitle>
                <CardDescription>Customers with highest spending on this day</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDayIndex(Math.max(0, selectedDayIndex - 1))}
                  disabled={selectedDayIndex === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDayIndex(Math.min(dailyMetrics.length - 1, selectedDayIndex + 1))}
                  disabled={selectedDayIndex === dailyMetrics.length - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedMetric.top_customers.map((customer, idx) => (
                <div key={`${customer.email}-${idx}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{customer.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{customer.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(customer.spending) || 0)}</p>
                    <p className="text-xs text-muted-foreground">{Number(customer.orders) || 0} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Overview */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 xl:grid-cols-2">
      {/* Top Customers for Entire Period */}
      {allTopCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>Customers with highest spending across the period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allTopCustomers.map((customer, idx) => (
                <div key={`${customer.email}-${idx}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{customer.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{customer.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(customer.spending)}</p>
                    <p className="text-xs text-muted-foreground">{customer.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* First-Time Customers for Period */}
      {firstTimeCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-accent" />
              First-Time Customers
            </CardTitle>
            <CardDescription>New customers who placed their first order in this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {firstTimeCustomers.map((customer, idx) => (
                <div 
                  key={`${customer.email}-${idx}`} 
                  className="flex items-center justify-between p-3 bg-accent/5 hover:bg-accent/10 transition-colors rounded-lg border border-accent/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-sm font-medium text-accent">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{customer.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{customer.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-accent">{formatCurrency(customer.spending)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(customer.firstOrderDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
