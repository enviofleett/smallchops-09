import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  Target, 
  DollarSign, 
  Gift,
  RefreshCw 
} from 'lucide-react';
import { formatCurrency } from '@/lib/discountCalculations';

interface PromotionSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  code?: string;
  created_at: string;
  usage_count: number;
}

const fetchPromotionSummary = async (): Promise<PromotionSummary[]> => {
  const { data, error } = await (supabase as any)
    .from('promotions')
    .select('id, name, type, status, code, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // Get usage counts for each promotion
  const promotionsWithUsage = await Promise.all(
    (data || []).map(async (promotion) => {
      const { count } = await (supabase as any)
        .from('promotion_usage')
        .select('*', { count: 'exact', head: true })
        .eq('promotion_id', promotion.id);
      
      return {
        ...promotion,
        usage_count: count || 0
      };
    })
  );

  return promotionsWithUsage;
};

const fetchRecentActivity = async () => {
  const { data, error } = await (supabase as any)
    .from('promotion_usage')
    .select(`
      *,
      promotions!inner(name, type, code)
    `)
    .order('used_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
};

export const PromotionAnalyticsDashboard: React.FC = () => {
  const { data: promotions = [], isLoading, refetch } = useQuery({
    queryKey: ['promotion-summary'],
    queryFn: fetchPromotionSummary,
    staleTime: 10 * 60 * 1000,
    refetchInterval: false,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['promotion-recent-activity'],
    queryFn: fetchRecentActivity,
    staleTime: 15 * 60 * 1000,
    refetchInterval: false,
  });

  const aggregatedStats = React.useMemo(() => {
    const activePromotions = promotions.filter(p => p.status === 'active');
    const totalUsage = promotions.reduce((sum, p) => sum + p.usage_count, 0);
    
    return {
      totalPromotions: promotions.length,
      activePromotions: activePromotions.length,
      totalUsage,
      recentActivityCount: recentActivity.length,
    };
  }, [promotions, recentActivity]);

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
              Total Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Gift className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold">{aggregatedStats.totalPromotions}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">{aggregatedStats.activePromotions}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="text-2xl font-bold">{aggregatedStats.totalUsage}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-orange-600" />
              <span className="text-2xl font-bold">{aggregatedStats.recentActivityCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recent-activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Promotions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {promotions.slice(0, 10).map((promotion) => (
                  <div key={promotion.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">{promotion.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {promotion.code && `Code: ${promotion.code}`}
                        </p>
                      </div>
                      <Badge variant={promotion.status === 'active' ? 'default' : 'secondary'}>
                        {promotion.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{promotion.usage_count} uses</p>
                      <p className="text-sm text-muted-foreground">
                        Status: {promotion.status}
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
              <CardTitle>Recent Promotion Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.slice(0, 20).map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Gift className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">{activity.promotions?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Applied • {formatCurrency(activity.discount_amount)} discount
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.used_at).toLocaleString()}
                      </p>
                      {activity.customer_email && (
                        <p className="text-xs text-muted-foreground">
                          {activity.customer_email}
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