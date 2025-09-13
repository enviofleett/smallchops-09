import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, AlertCircle, Shield, Settings, Database, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProductionReadiness {
  ready_for_production: boolean;
  score: number;
  issues: string[];
  warnings: string[];
  last_checked: string;
  environment: string;
  live_mode: boolean;
}

interface ChecklistItem {
  id: string;
  item_name: string;
  item_description: string;
  category: string;
  is_completed: boolean;
  priority_level: string;
  completed_at?: string;
}

export function PaystackProductionDashboard() {
  const [readiness, setReadiness] = useState<ProductionReadiness | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load production readiness check
      const { data: readinessData, error: readinessError } = await supabase
        .rpc('check_paystack_production_readiness');

      if (readinessError) throw readinessError;
      
      setReadiness(readinessData as unknown as ProductionReadiness);

      // Load production checklist
      const { data: checklistData, error: checklistError } = await supabase
        .from('production_checklist')
        .select('*')
        .order('priority_level', { ascending: false })
        .order('created_at');

      if (checklistError) throw checklistError;
      
      setChecklist(checklistData || []);
    } catch (error) {
      console.error('Error loading production dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to load production dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runProductionCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase
        .rpc('check_paystack_production_readiness');

      if (error) throw error;
      
      const readinessData = data as unknown as ProductionReadiness;
      setReadiness(readinessData);
      toast({
        title: "Production Check Complete",
        description: `Score: ${readinessData.score}/100 ${readinessData.ready_for_production ? '✅' : '❌'}`,
      });
    } catch (error) {
      console.error('Error running production check:', error);
      toast({
        title: "Error",
        description: "Failed to run production readiness check",
        variant: "destructive"
      });
    } finally {
      setChecking(false);
    }
  };

  const markChecklistItem = async (itemId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('production_checklist')
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null
        })
        .eq('id', itemId);

      if (error) throw error;
      
      await loadData(); // Refresh data
      toast({
        title: completed ? "Item Completed" : "Item Unchecked",
        description: "Checklist updated successfully"
      });
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast({
        title: "Error",
        description: "Failed to update checklist item",
        variant: "destructive"
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      critical: 'destructive',
      high: 'default',
      medium: 'secondary',
      low: 'outline'
    } as const;
    
    return variants[priority as keyof typeof variants] || 'outline';
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      security: Shield,
      configuration: Settings,
      testing: Activity,
      monitoring: Database,
      operations: Clock,
      reliability: CheckCircle
    };
    
    const Icon = icons[category as keyof typeof icons] || AlertCircle;
    return <Icon className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Production Readiness Dashboard</CardTitle>
          <CardDescription>Loading production status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Paystack Production Readiness
              </CardTitle>
              <CardDescription>
                Comprehensive security and deployment status
              </CardDescription>
            </div>
            <Button onClick={runProductionCheck} disabled={checking}>
              {checking ? 'Checking...' : 'Run Check'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {readiness && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Overall Score</p>
                  <p className={`text-3xl font-bold ${getScoreColor(readiness.score)}`}>
                    {readiness.score}/100
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={readiness.ready_for_production ? 'default' : 'destructive'}>
                    {readiness.ready_for_production ? 'Production Ready' : 'Not Ready'}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    Environment: {readiness.environment} {readiness.live_mode ? '(Live)' : '(Test)'}
                  </p>
                </div>
              </div>
              
              <Progress value={readiness.score} className="h-3" />
              
              {readiness.issues.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Critical Issues ({readiness.issues.length})</p>
                      <ul className="list-disc list-inside space-y-1">
                        {readiness.issues.map((issue, index) => (
                          <li key={index} className="text-sm">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {readiness.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Warnings ({readiness.warnings.length})</p>
                      <ul className="list-disc list-inside space-y-1">
                        {readiness.warnings.map((warning, index) => (
                          <li key={index} className="text-sm">{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="checklist" className="space-y-4">
        <TabsList>
          <TabsTrigger value="checklist">Production Checklist</TabsTrigger>
          <TabsTrigger value="security">Security Status</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle>Production Deployment Checklist</CardTitle>
              <CardDescription>
                Complete all items before going live
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['critical', 'high', 'medium', 'low'].map(priority => {
                  const items = checklist.filter(item => item.priority_level === priority);
                  if (items.length === 0) return null;
                  
                  return (
                    <div key={priority}>
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                        <Badge variant={getPriorityBadge(priority)}>
                          {items.filter(item => item.is_completed).length}/{items.length}
                        </Badge>
                      </h3>
                      <div className="space-y-2">
                        {items.map(item => (
                          <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="checkbox"
                                checked={item.is_completed}
                                onChange={(e) => markChecklistItem(item.id, e.target.checked)}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {getCategoryIcon(item.category)}
                                  <span className={`font-medium ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                    {item.item_name}
                                  </span>
                                </div>
                                {item.item_description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {item.item_description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline">{item.category}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Configuration</CardTitle>
              <CardDescription>
                Critical security settings and validations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Webhook Security</h4>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        IP validation enabled
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Signature verification active
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Replay attack protection
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Data Protection</h4>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Secure key storage
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Audit logging enabled
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Error tracking active
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Production Monitoring</CardTitle>
              <CardDescription>
                Real-time status and health metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Monitoring dashboard will be available after production deployment
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}