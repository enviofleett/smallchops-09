import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, ShoppingCart, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export function DiscountAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['discount-analytics'],
    queryFn: async () => {
      // Get total discount codes
      const { data: totalCodes } = await supabase
        .from('discount_codes')
        .select('id', { count: 'exact' });

      // Get active discount codes
      const { data: activeCodes } = await supabase
        .from('discount_codes')
        .select('id', { count: 'exact' })
        .eq('is_active', true);

      // Get total usage in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentUsage } = await supabase
        .from('discount_code_usage')
        .select('discount_amount, final_amount, original_amount')
        .gte('used_at', thirtyDaysAgo);

      // Calculate metrics
      const totalUsage = recentUsage?.length || 0;
      const totalDiscountAmount = recentUsage?.reduce((sum, usage) => sum + usage.discount_amount, 0) || 0;
      const totalOrderValue = recentUsage?.reduce((sum, usage) => sum + usage.original_amount, 0) || 0;
      
      // Get unique customers who used discounts
      const { data: uniqueCustomers } = await supabase
        .from('discount_code_usage')
        .select('customer_email')
        .gte('used_at', thirtyDaysAgo);

      const uniqueCustomerCount = new Set(uniqueCustomers?.map(u => u.customer_email)).size;

      return {
        totalCodes: totalCodes?.length || 0,
        activeCodes: activeCodes?.length || 0,
        totalUsage,
        totalDiscountAmount,
        totalOrderValue,
        uniqueCustomerCount,
        averageDiscount: totalUsage > 0 ? totalDiscountAmount / totalUsage : 0,
      };
    }
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse bg-muted h-8 w-16 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: "Total Codes",
      value: analytics?.totalCodes || 0,
      description: `${analytics?.activeCodes || 0} active`,
      icon: Percent,
    },
    {
      title: "Usage (30 days)",
      value: analytics?.totalUsage || 0,
      description: "Times used",
      icon: ShoppingCart,
    },
    {
      title: "Unique Customers",
      value: analytics?.uniqueCustomerCount || 0,
      description: "Used discounts",
      icon: Users,
    },
    {
      title: "Total Savings",
      value: `₦${(analytics?.totalDiscountAmount || 0).toLocaleString()}`,
      description: "Customer savings",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {metric.title}
            </CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <p className="text-xs text-muted-foreground">
              {metric.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}