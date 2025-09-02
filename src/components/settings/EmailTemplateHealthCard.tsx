import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Mail, TestTube, RefreshCw, AlertTriangle, CheckCircle, 
  Clock, TrendingUp, Zap, FileText, Send 
} from 'lucide-react';

interface TemplateHealthData {
  total_templates: number;
  active_templates: number;
  transactional_count: number;
  marketing_count: number;
  stale_templates: number;
  last_updated: string;
}

interface TestResult {
  template_key: string;
  template_name: string;
  status: 'success' | 'failed';
  error?: string;
}

export const EmailTemplateHealthCard: React.FC = () => {
  const [healthData, setHealthData] = useState<TemplateHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_template_health')
        .select('*')
        .single();

      if (error) throw error;
      setHealthData(data);
    } catch (error: any) {
      console.error('Failed to load template health data:', error);
      toast.error('Failed to load template health data');
    } finally {
      setLoading(false);
    }
  };

  const testAllTemplates = async () => {
    try {
      setTesting(true);
      setTestResults([]);
      setShowResults(true);

      // Get all active templates
      const { data: templates, error } = await supabase
        .from('enhanced_email_templates')
        .select('template_key, template_name')
        .eq('is_active', true)
        .limit(5); // Test only first 5 templates to avoid overwhelming the system

      if (error) throw error;

      const results: TestResult[] = [];

      // Test each template
      for (const template of templates || []) {
        try {
          const { error: testError } = await supabase.functions.invoke('unified-smtp-sender', {
            body: {
              to: 'test@example.com', // This won't actually send, just validates template
              template_key: template.template_key,
              variables: {
                business_name: 'Test Business',
                customer_name: 'Test Customer',
                current_year: new Date().getFullYear().toString(),
                order_number: 'TEST-123',
                test_timestamp: new Date().toISOString()
              },
              dry_run: true // Flag to prevent actual sending
            }
          });

          results.push({
            template_key: template.template_key,
            template_name: template.template_name,
            status: testError ? 'failed' : 'success',
            error: testError?.message
          });
        } catch (error: any) {
          results.push({
            template_key: template.template_key,
            template_name: template.template_name,
            status: 'failed',
            error: error.message
          });
        }
      }

      setTestResults(results);
      
      const successCount = results.filter(r => r.status === 'success').length;
      const totalCount = results.length;
      
      if (successCount === totalCount) {
        toast.success(`All ${totalCount} templates passed validation`);
      } else {
        toast.warning(`${successCount}/${totalCount} templates passed validation`);
      }
    } catch (error: any) {
      console.error('Failed to test templates:', error);
      toast.error('Failed to test templates: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const getHealthScore = () => {
    if (!healthData) return 0;
    
    const activeRatio = healthData.total_templates > 0 
      ? healthData.active_templates / healthData.total_templates 
      : 0;
    
    const staleRatio = healthData.total_templates > 0 
      ? healthData.stale_templates / healthData.total_templates 
      : 0;
    
    // Health score: 100% if all active and no stale templates
    return Math.round((activeRatio * 100) - (staleRatio * 20));
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (score >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const healthScore = getHealthScore();

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Template Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadHealthData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={testAllTemplates}
              disabled={testing}
              className="flex items-center gap-2"
            >
              {testing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4" />
                  Test All
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {healthData ? (
            <div className="space-y-4">
              {/* Health Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getHealthIcon(healthScore)}
                  <span className="font-medium">Health Score</span>
                </div>
                <div className={`text-2xl font-bold ${getHealthColor(healthScore)}`}>
                  {healthScore}%
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{healthData.active_templates}</div>
                  <div className="text-sm text-muted-foreground">Active Templates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{healthData.total_templates}</div>
                  <div className="text-sm text-muted-foreground">Total Templates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{healthData.transactional_count}</div>
                  <div className="text-sm text-muted-foreground">Transactional</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{healthData.marketing_count}</div>
                  <div className="text-sm text-muted-foreground">Marketing</div>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={healthData.active_templates > 0 ? 'default' : 'secondary'}>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {healthData.active_templates} Active
                </Badge>
                {healthData.stale_templates > 0 && (
                  <Badge variant="outline" className="text-yellow-600">
                    <Clock className="h-3 w-3 mr-1" />
                    {healthData.stale_templates} Stale (30+ days)
                  </Badge>
                )}
                <Badge variant="outline">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Last Updated: {new Date(healthData.last_updated).toLocaleDateString()}
                </Badge>
              </div>

              {/* Recommendations */}
              {healthScore < 80 && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium text-yellow-800 dark:text-yellow-200">Recommendations</span>
                  </div>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    {healthData.stale_templates > 0 && (
                      <li>• Review and update {healthData.stale_templates} stale templates</li>
                    )}
                    {healthData.total_templates - healthData.active_templates > 0 && (
                      <li>• Consider activating or removing {healthData.total_templates - healthData.active_templates} inactive templates</li>
                    )}
                    {healthData.total_templates < 5 && (
                      <li>• Consider seeding more template types for better coverage</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No template health data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {showResults && testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Template Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{result.template_name}</div>
                    <div className="text-sm text-muted-foreground">{result.template_key}</div>
                    {result.error && (
                      <div className="text-xs text-red-600 mt-1">{result.error}</div>
                    )}
                  </div>
                  <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                    {result.status === 'success' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Passed
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Failed
                      </>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};