import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PromotionUsageMonitor } from '@/components/promotions/PromotionUsageMonitor';
import { usePromotionAnalytics } from '@/hooks/usePromotionAnalytics';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  DollarSign,
  Target
} from 'lucide-react';
import { formatCurrency } from '@/lib/discountCalculations';

interface OptimizationRecommendation {
  type: 'performance' | 'configuration' | 'timing' | 'targeting';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
}

export function PromotionOptimizationPanel() {
  const { data: analytics, isLoading } = usePromotionAnalytics();

  const generateRecommendations = (): OptimizationRecommendation[] => {
    if (!analytics) return [];

    const recommendations: OptimizationRecommendation[] = [];
    const { metrics, summary } = analytics;

    // Performance recommendations
    const lowPerformingPromotions = metrics.filter(m => m.totalUsage < 5);
    if (lowPerformingPromotions.length > 0) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        title: 'Low Usage Promotions Detected',
        description: `${lowPerformingPromotions.length} promotion(s) have less than 5 uses. Consider optimizing or pausing them.`,
        action: 'Review promotion visibility and terms'
      });
    }

    // High performing promotions
    const highPerformingPromotions = metrics.filter(m => m.totalUsage > 50);
    if (highPerformingPromotions.length > 0) {
      recommendations.push({
        type: 'performance',
        severity: 'low',
        title: 'High Performing Promotions',
        description: `${highPerformingPromotions.length} promotion(s) are performing well. Consider extending or creating similar offers.`,
        action: 'Analyze successful patterns for replication'
      });
    }

    // Budget recommendations
    if (summary.totalDiscount > 10000) {
      recommendations.push({
        type: 'configuration',
        severity: 'high',
        title: 'High Discount Spending',
        description: `Total discounts exceed ${formatCurrency(10000)}. Monitor ROI and consider usage limits.`,
        action: 'Review discount budgets and set usage limits'
      });
    }

    // Conversion rate recommendations
    if (summary.averageConversionRate < 20) {
      recommendations.push({
        type: 'targeting',
        severity: 'medium',
        title: 'Low Conversion Rate',
        description: `Average conversion rate is ${summary.averageConversionRate.toFixed(1)}%. Consider improving targeting or promotion appeal.`,
        action: 'A/B test different promotion strategies'
      });
    }

    return recommendations;
  };

  const recommendations = generateRecommendations();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Target className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      high: 'destructive',
      medium: 'secondary',
      low: 'default'
    } as const;
    
    return (
      <Badge variant={variants[severity as keyof typeof variants] || 'default'}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Promotion Optimization</h2>
        <p className="text-muted-foreground">
          Monitor performance and get recommendations to optimize your promotion strategy
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations">
            Recommendations
            {recommendations.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {recommendations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="monitor">Live Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Promotions</p>
                      <p className="text-2xl font-bold">{analytics.summary.totalPromotions}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Usage</p>
                      <p className="text-2xl font-bold">{analytics.summary.totalUsage}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Discounts</p>
                      <p className="text-2xl font-bold">{formatCurrency(analytics.summary.totalDiscount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Conversion</p>
                      <p className="text-2xl font-bold">{analytics.summary.averageConversionRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Great! No critical optimization recommendations at this time. Your promotion strategy appears to be well-balanced.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <Alert key={index}>
                      <div className="flex items-start space-x-3">
                        {getSeverityIcon(rec.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{rec.title}</h4>
                            {getSeverityBadge(rec.severity)}
                          </div>
                          <AlertDescription className="mb-2">
                            {rec.description}
                          </AlertDescription>
                          {rec.action && (
                            <p className="text-sm font-medium text-primary">
                              Recommended Action: {rec.action}
                            </p>
                          )}
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4">
          <PromotionUsageMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}