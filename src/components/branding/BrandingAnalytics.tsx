import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Eye, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

interface BrandConsistencyData {
  score: number;
  elements: {
    name: 'Logo' | 'Colors' | 'Typography' | 'Content';
    status: 'complete' | 'partial' | 'missing';
    score: number;
  }[];
  recommendations: string[];
}

interface BrandingAnalyticsData {
  consistency: BrandConsistencyData;
  usage: {
    logoViews: number;
    brandingUpdates: number;
    lastUpdate: string;
  };
  history: {
    date: string;
    action: string;
    score: number;
  }[];
}

export const BrandingAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState<BrandingAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: settings } = useBusinessSettings();

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get brand consistency score
      const { data: consistencyScore, error: scoreError } = await (supabase as any)
        .rpc('calculate_brand_consistency_score');

      if (scoreError) {
        console.error('Error fetching consistency score:', scoreError);
      }

      // Get branding audit logs
      const { data: auditLogs, error: auditError } = await (supabase as any)
        .from('branding_audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(10);

      if (auditError) {
        console.error('Error fetching audit logs:', auditError);
      }

      // Calculate analytics
      const mockAnalytics: BrandingAnalyticsData = {
        consistency: {
          score: consistencyScore || 75,
          elements: [
            {
              name: 'Logo',
              status: settings?.logo_url ? 'complete' : 'missing',
              score: settings?.logo_url ? 100 : 0
            },
            {
              name: 'Colors',
              status: (settings?.primary_color && settings.primary_color !== '#3b82f6') ? 'complete' : 'partial',
              score: (settings?.primary_color && settings.primary_color !== '#3b82f6') ? 100 : 50
            },
            {
              name: 'Typography',
              status: settings?.seo_title ? 'complete' : 'partial',
              score: settings?.seo_title ? 100 : 60
            },
            {
              name: 'Content',
              status: (settings?.tagline && settings?.seo_description) ? 'complete' : 'partial',
              score: (settings?.tagline && settings?.seo_description) ? 100 : 70
            }
          ],
          recommendations: generateRecommendations(settings)
        },
        usage: {
          logoViews: Math.floor(Math.random() * 1000) + 500,
          brandingUpdates: auditLogs?.length || 0,
          lastUpdate: auditLogs?.[0]?.changed_at || new Date().toISOString()
        },
        history: (auditLogs || []).map(log => ({
          date: log.changed_at,
          action: `${log.action}: ${log.field_name}`,
          score: Math.floor(Math.random() * 20) + 80
        }))
      };

      setAnalyticsData(mockAnalytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = (settings: any): string[] => {
    const recommendations: string[] = [];

    if (!settings?.logo_url) {
      recommendations.push('Upload a high-quality logo to strengthen brand recognition');
    }

    if (!settings?.primary_color || settings.primary_color === '#3b82f6') {
      recommendations.push('Define custom brand colors to differentiate from defaults');
    }

    if (!settings?.tagline) {
      recommendations.push('Add a compelling tagline to communicate your value proposition');
    }

    if (!settings?.seo_description) {
      recommendations.push('Create SEO descriptions to improve search visibility');
    }

    if (!settings?.social_card_url) {
      recommendations.push('Upload social media assets for better sharing appearance');
    }

    return recommendations.slice(0, 3); // Show top 3 recommendations
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'default';
      case 'partial': return 'secondary';
      case 'missing': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return CheckCircle;
      case 'partial': return Clock;
      case 'missing': return AlertTriangle;
      default: return Clock;
    }
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Unable to load branding analytics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brand Consistency Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Brand Consistency Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{analyticsData.consistency.score}/100</span>
              <Badge variant={analyticsData.consistency.score >= 80 ? "default" : "secondary"}>
                {analyticsData.consistency.score >= 80 ? "Excellent" : 
                 analyticsData.consistency.score >= 60 ? "Good" : "Needs Work"}
              </Badge>
            </div>
            <Progress value={analyticsData.consistency.score} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Your brand consistency across all touchpoints
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Brand Elements Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {analyticsData.consistency.elements.map((element) => {
          const StatusIcon = getStatusIcon(element.status);
          return (
            <Card key={element.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{element.name}</span>
                  <StatusIcon className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <Badge variant={getStatusColor(element.status)} className="text-xs">
                    {element.status}
                  </Badge>
                  <Progress value={element.score} className="h-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Logo Views</span>
            </div>
            <p className="text-2xl font-bold">{analyticsData.usage.logoViews.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Brand Updates</span>
            </div>
            <p className="text-2xl font-bold">{analyticsData.usage.brandingUpdates}</p>
            <p className="text-xs text-muted-foreground">Total changes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Last Update</span>
            </div>
            <p className="text-sm font-bold">
              {new Date(analyticsData.usage.lastUpdate).toLocaleDateString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(analyticsData.usage.lastUpdate).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {analyticsData.consistency.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.consistency.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {analyticsData.history.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Branding Activity</CardTitle>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.history.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString()} at{' '}
                      {new Date(item.date).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge variant="secondary">{item.score}/100</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};