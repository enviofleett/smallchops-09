import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  DollarSign, 
  Gift,
  AlertTriangle,
  RefreshCw 
} from 'lucide-react';
import { formatCurrency } from '@/lib/discountCalculations';

interface PromotionAnalytics {
  id: string;
  promotion_id: string;
  date: string;
  total_usage: number;
  total_discount_given: number;
  total_revenue_impact: number;
  unique_customers: number;
  conversion_rate: number;
  avg_order_value: number;
  promotion: {
    name: string;
    type: string;
    status: string;
    code?: string;
    usage_limit?: number;
    usage_count: number;
  };
}

const fetchPromotionAnalytics = async (): Promise<PromotionAnalytics[]> => {
  const { data, error } = await supabase
    .from('promotion_analytics')
    .select(`
      *,
      promotion:promotions(
        name,
        type,
        status,
        code,
        usage_limit,
        usage_count
      )
    `)
    .order('date', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
};

const fetchPromotionUsageAudit = async () => {
  const { data, error } = await supabase
    .from('promotion_usage_audit')
    .select(`
      *,
      promotion:promotions(name, type, code)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
};

const fetchTopPerformingPromotions = async () => {
  const { data, error } = await supabase
    .from('promotion_analytics')
    .select(`
      promotion_id,
      total_usage,
      total_discount_given,
      total_revenue_impact,
      promotion:promotions(name, type, code, status)
    `)
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('total_usage', { ascending: false })
    .limit(10);

  if (error) throw error;
  
  // Group by promotion_id and sum manually
  const grouped = (data || []).reduce((acc: any, curr: any) => {
    const key = curr.promotion_id;
    if (!acc[key]) {
      acc[key] = {
        promotion_id: key,
        promotion: curr.promotion,
        total_usage: 0,
        total_discount: 0,
        total_revenue: 0
      };
    }
    acc[key].total_usage += curr.total_usage;
    acc[key].total_discount += curr.total_discount_given;
    acc[key].total_revenue += curr.total_revenue_impact;
    return acc;
  }, {});
  
  return Object.values(grouped).sort((a: any, b: any) => b.total_usage - a.total_usage);
};

export const PromotionAnalyticsDashboard: React.FC = () => {
  const { data: analytics = [], isLoading, refetch } = useQuery({
    queryKey: ['promotion-analytics'],
    queryFn: fetchPromotionAnalytics,
    staleTime: 10 * 60 * 1000,          // 10 minutes cache
    refetchInterval: false,              // Disable auto-refresh
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['promotion-usage-audit'],
    queryFn: fetchPromotionUsageAudit,
    staleTime: 15 * 60 * 1000,          // 15 minutes cache
    refetchInterval: false,              // Disable auto-refresh
  });

  const { data: topPromotions = [] } = useQuery({
    queryKey: ['top-performing-promotions'],
    queryFn: fetchTopPerformingPromotions,
    staleTime: 15 * 60 * 1000,          // 15 minutes cache
    refetchInterval: false,              // Disable auto-refresh
  });

  const aggregatedStats = React.useMemo(() => {
    const last7Days = analytics.filter(a => 
      new Date(a.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    return {
      totalUsage: last7Days.reduce((sum, a) => sum + a.total_usage, 0),
      totalDiscount: last7Days.reduce((sum, a) => sum + a.total_discount_given, 0),
      totalRevenue: last7Days.reduce((sum, a) => sum + a.total_revenue_impact, 0),
      avgConversion: last7Days.length > 0 
        ? last7Days.reduce((sum, a) => sum + a.conversion_rate, 0) / last7Days.length 
        : 0,
    };
  }, [analytics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading promotion analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Promotion Analytics</h2>
          <p className="text-muted-foreground">Monitor promotion performance and ROI</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Usage (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold">{aggregatedStats.totalUsage}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Discounts Given
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Gift className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">
                {formatCurrency(aggregatedStats.totalDiscount)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <span className="text-2xl font-bold">
                {formatCurrency(aggregatedStats.totalRevenue)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <span className="text-2xl font-bold">
                {aggregatedStats.avgConversion.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
          <TabsTrigger value="recent-activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.slice(0, 10).map((analytic) => (
                  <div key={analytic.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">{analytic.promotion.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(analytic.date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={analytic.promotion.status === 'active' ? 'default' : 'secondary'}>
                        {analytic.promotion.type}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {analytic.total_usage} uses • {formatCurrency(analytic.total_discount_given)} discount
                      </p>
                      <p className="text-sm font-medium">
                        Revenue: {formatCurrency(analytic.total_revenue_impact)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-performers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Promotions (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPromotions.map((promo: any, index) => (
                  <div key={promo.promotion_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{promo.promotion?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {promo.promotion?.code && `Code: ${promo.promotion.code}`}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {promo.promotion?.type || 'N/A'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{promo.total_usage || 0} uses</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(promo.total_revenue || 0)} revenue
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent-activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Promotion Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      {log.usage_type === 'applied' && <Gift className="w-4 h-4 text-green-600" />}
                      {log.usage_type === 'expired' && <AlertTriangle className="w-4 h-4 text-orange-600" />}
                      {log.usage_type === 'reverted' && <TrendingDown className="w-4 h-4 text-red-600" />}
                      <div>
                        <p className="text-sm font-medium">{log.promotion.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.usage_type} • {formatCurrency(log.discount_amount)} discount
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                      {log.customer_email && (
                        <p className="text-xs text-muted-foreground">
                          {log.customer_email}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};