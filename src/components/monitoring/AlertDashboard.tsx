import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, XCircle, Clock, Zap, Shield } from 'lucide-react';

interface AlertRule {
  id: string;
  rule_name: string;
  severity: string;
  threshold_value: number;
  is_active: boolean;
  last_triggered_at?: string;
  trigger_count: number;
}

interface AlertNotification {
  id: string;
  message: string;
  severity: string;
  delivery_status: string;
  created_at: string;
}

interface CircuitBreakerStatus {
  name: string;
  state: string;
  failureCount: number;
}

export const AlertDashboard: React.FC = () => {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertNotification[]>([]);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAlertData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch alert rules
      const { data: rules, error: rulesError } = await supabase
        .from('alert_rules')
        .select('*')
        .order('severity', { ascending: false });

      if (rulesError) throw rulesError;

      // Fetch recent alert notifications
      const { data: notifications, error: notificationsError } = await supabase
        .from('alert_notifications')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (notificationsError) throw notificationsError;

      // Fetch circuit breaker status
      const { data: cbStatus, error: cbError } = await supabase.functions.invoke(
        'order-manager',
        {
          method: 'GET',
          body: { action: 'get_circuit_breaker_status' }
        }
      );

      if (cbError) throw cbError;

      setAlertRules(rules || []);
      setRecentAlerts(notifications || []);
      setCircuitBreakers(cbStatus?.circuitBreakers || []);
    } catch (error) {
      console.error('Failed to fetch alert data:', error);
      toast({
        title: "Error",
        description: "Failed to load alert dashboard data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAlertRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) throw error;

      setAlertRules(rules => 
        rules.map(rule => 
          rule.id === ruleId ? { ...rule, is_active: isActive } : rule
        )
      );

      toast({
        title: "Success",
        description: `Alert rule ${isActive ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      console.error('Failed to toggle alert rule:', error);
      toast({
        title: "Error",
        description: "Failed to update alert rule",
        variant: "destructive"
      });
    }
  };

  const resetCircuitBreaker = async (breakerName: string) => {
    try {
      const { error } = await supabase.functions.invoke(
        'order-manager',
        {
          body: { 
            action: 'reset_circuit_breaker',
            breakerName 
          }
        }
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: `Circuit breaker ${breakerName} reset successfully`
      });

      fetchAlertData(); // Refresh data
    } catch (error) {
      console.error('Failed to reset circuit breaker:', error);
      toast({
        title: "Error",
        description: "Failed to reset circuit breaker",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchAlertData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlertData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'warning':
      case 'medium':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
      case 'medium':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getCircuitBreakerIcon = (state: string) => {
    switch (state) {
      case 'open':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'half-open':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <Shield className="h-4 w-4 text-success" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Alert Dashboard...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = recentAlerts.filter(a => a.severity === 'warning' || a.severity === 'medium').length;
  const openCircuitBreakers = circuitBreakers.filter(cb => cb.state === 'open').length;

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Alerts (24h)</p>
                <p className="text-2xl font-bold text-destructive">{criticalAlerts}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Warning Alerts (24h)</p>
                <p className="text-2xl font-bold text-warning">{warningAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open Circuit Breakers</p>
                <p className="text-2xl font-bold text-destructive">{openCircuitBreakers}</p>
              </div>
              <Shield className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="notifications">Recent Alerts</TabsTrigger>
          <TabsTrigger value="circuit-breakers">Circuit Breakers</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules Configuration</CardTitle>
              <CardDescription>
                Manage automated alert rules and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alertRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      {getSeverityIcon(rule.severity)}
                      <div>
                        <h3 className="font-medium">{rule.rule_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Threshold: {rule.threshold_value} | 
                          Triggered: {rule.trigger_count} times
                          {rule.last_triggered_at && (
                            <span> | Last: {new Date(rule.last_triggered_at).toLocaleString()}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getSeverityBadgeVariant(rule.severity)}>
                        {rule.severity}
                      </Badge>
                      <Button
                        variant={rule.is_active ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleAlertRule(rule.id, !rule.is_active)}
                      >
                        {rule.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Recent Alert Notifications</CardTitle>
              <CardDescription>
                Latest alert notifications from the past 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentAlerts.length > 0 ? (
                  recentAlerts.map((alert) => (
                    <Alert key={alert.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2">
                          {getSeverityIcon(alert.severity)}
                          <div>
                            <AlertDescription className="font-medium">
                              {alert.message}
                            </AlertDescription>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(alert.created_at).toLocaleString()} | 
                              Status: {alert.delivery_status}
                            </p>
                          </div>
                        </div>
                        <Badge variant={getSeverityBadgeVariant(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </Alert>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-success mx-auto mb-2" />
                    <p className="text-muted-foreground">No recent alerts</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="circuit-breakers">
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker Status</CardTitle>
              <CardDescription>
                Monitor and manage circuit breakers for system resilience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {circuitBreakers.map((breaker) => (
                  <div
                    key={breaker.name}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      {getCircuitBreakerIcon(breaker.state)}
                      <div>
                        <h3 className="font-medium capitalize">
                          {breaker.name.replace('_', ' ')} Service
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          State: {breaker.state.toUpperCase()} | 
                          Failures: {breaker.failureCount}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={breaker.state === 'open' ? 'destructive' : 
                               breaker.state === 'half-open' ? 'secondary' : 'default'}
                      >
                        {breaker.state.toUpperCase()}
                      </Badge>
                      {breaker.state === 'open' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetCircuitBreaker(breaker.name)}
                        >
                          <Zap className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
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