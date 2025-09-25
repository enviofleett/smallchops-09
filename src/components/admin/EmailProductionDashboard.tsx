import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductionEmailSimulator } from './ProductionEmailSimulator';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Settings,
  Activity,
  Database,
  Server,
  Users,
  Zap
} from 'lucide-react';

interface EmailStats {
  totalEmails: number;
  sentEmails: number;
  failedEmails: number;
  queuedEmails: number;
  successRate: number;
  averageDeliveryTime: number;
}

interface SystemHealth {
  smtpStatus: 'healthy' | 'warning' | 'error';
  templatesActive: number;
  queueHealth: 'healthy' | 'warning' | 'error';
  rateLimitStatus: 'healthy' | 'warning' | 'error';
}

export const EmailProductionDashboard: React.FC = () => {
  const [emailStats, setEmailStats] = useState<EmailStats>({
    totalEmails: 0,
    sentEmails: 0,
    failedEmails: 0,
    queuedEmails: 0,
    successRate: 0,
    averageDeliveryTime: 0
  });

  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    smtpStatus: 'healthy',
    templatesActive: 0,
    queueHealth: 'healthy',
    rateLimitStatus: 'healthy'
  });

  const [recentEmails, setRecentEmails] = useState<any[]>([]);
  const [templateStats, setTemplateStats] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    await Promise.all([
      loadEmailStats(),
      loadSystemHealth(),
      loadRecentEmails(),
      loadTemplateStats()
    ]);
  };

  const loadEmailStats = async () => {
    try {
      // Get email stats from last 24 hours
      const { data: deliveryData } = await supabase
        .from('smtp_delivery_confirmations')
        .select('delivery_status, delivery_time_ms, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Get queued emails
      const { data: queueData } = await supabase
        .from('communication_events')
        .select('status')
        .in('status', ['queued', 'processing']);

      if (deliveryData) {
        const totalEmails = deliveryData.length;
        const sentEmails = deliveryData.filter(d => d.delivery_status === 'sent').length;
        const failedEmails = deliveryData.filter(d => d.delivery_status === 'failed').length;
        const queuedEmails = queueData?.length || 0;
        const successRate = totalEmails > 0 ? (sentEmails / totalEmails) * 100 : 0;
        const averageDeliveryTime = sentEmails > 0 ? 
          deliveryData
            .filter(d => d.delivery_status === 'sent' && d.delivery_time_ms)
            .reduce((sum, d) => sum + (d.delivery_time_ms || 0), 0) / sentEmails : 0;

        setEmailStats({
          totalEmails,
          sentEmails,
          failedEmails,
          queuedEmails,
          successRate,
          averageDeliveryTime
        });
      }
    } catch (error) {
      console.error('Error loading email stats:', error);
    }
  };

  const loadSystemHealth = async () => {
    try {
      // Check SMTP configuration
      const { data: smtpConfig } = await supabase
        .from('communication_settings')
        .select('use_smtp, smtp_host, smtp_user')
        .eq('use_smtp', true)
        .limit(1)
        .maybeSingle();

      // Check active templates
      const { data: templates } = await supabase
        .from('enhanced_email_templates')
        .select('id')
        .eq('is_active', true);

      // Check queue health (items older than 1 hour in queue)
      const { data: staleQueue } = await supabase
        .from('communication_events')
        .select('id')
        .eq('status', 'queued')
        .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      setSystemHealth({
        smtpStatus: smtpConfig ? 'healthy' : 'error',
        templatesActive: templates?.length || 0,
        queueHealth: (staleQueue?.length || 0) > 10 ? 'warning' : 'healthy',
        rateLimitStatus: 'healthy' // This would need a more sophisticated check
      });
    } catch (error) {
      console.error('Error loading system health:', error);
    }
  };

  const loadRecentEmails = async () => {
    try {
      const { data } = await supabase
        .from('smtp_delivery_confirmations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setRecentEmails(data);
      }
    } catch (error) {
      console.error('Error loading recent emails:', error);
    }
  };

  const loadTemplateStats = async () => {
    try {
      // Get template usage statistics
      const { data } = await supabase
        .from('smtp_delivery_logs')
        .select('subject, delivery_status, delivery_timestamp')
        .gte('delivery_timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('delivery_timestamp', { ascending: false });

      if (data) {
        // Group by template/subject
        const templateMap = new Map();
        data.forEach(email => {
          const template = email.subject.split(' - ')[0] || 'Unknown';
          const existing = templateMap.get(template) || { name: template, sent: 0, failed: 0 };
          if (email.delivery_status === 'sent') existing.sent++;
          else existing.failed++;
          templateMap.set(template, existing);
        });

        setTemplateStats(Array.from(templateMap.values()).slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading template stats:', error);
    }
  };

  const getHealthBadge = (status: 'healthy' | 'warning' | 'error') => {
    const variants = {
      healthy: { variant: 'default' as const, text: 'Healthy' },
      warning: { variant: 'outline' as const, text: 'Warning' },
      error: { variant: 'destructive' as const, text: 'Error' }
    };
    
    const config = variants[status];
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getHealthIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Production Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and test your production email system
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">SMTP Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getHealthIcon(systemHealth.smtpStatus)}
                  {getHealthBadge(systemHealth.smtpStatus)}
                </div>
              </div>
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Active Templates</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{systemHealth.templatesActive}</span>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Queue Health</p>
                <div className="flex items-center gap-2 mt-1">
                  {getHealthIcon(systemHealth.queueHealth)}
                  {getHealthBadge(systemHealth.queueHealth)}
                </div>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Success Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{emailStats.successRate.toFixed(1)}%</span>
                  <Badge variant={emailStats.successRate >= 95 ? 'default' : 'outline'}>
                    24h
                  </Badge>
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-blue-500" />
            <div className="text-3xl font-bold">{emailStats.totalEmails}</div>
            <div className="text-sm text-muted-foreground">Total Emails (24h)</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <div className="text-3xl font-bold">{emailStats.sentEmails}</div>
            <div className="text-sm text-muted-foreground">Successfully Sent</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-orange-500" />
            <div className="text-3xl font-bold">{emailStats.queuedEmails}</div>
            <div className="text-sm text-muted-foreground">In Queue</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="simulator" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="simulator">Email Simulator</TabsTrigger>
          <TabsTrigger value="recent">Recent Emails</TabsTrigger>
          <TabsTrigger value="templates">Template Usage</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="simulator">
          <ProductionEmailSimulator />
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Email Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentEmails.map((email) => (
                  <div key={email.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{email.recipient_email}</p>
                      <p className="text-sm text-muted-foreground">
                        Provider: {email.provider_used} • 
                        {email.delivery_time_ms && ` ${email.delivery_time_ms}ms`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={email.delivery_status === 'sent' ? 'default' : 'destructive'}>
                        {email.delivery_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(email.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Usage (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {templateStats.map((template, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Total: {template.sent + template.failed} emails
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{template.sent} sent</Badge>
                      {template.failed > 0 && (
                        <Badge variant="destructive">{template.failed} failed</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Delivery Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Average Delivery Time:</span>
                      <span className="font-medium">{emailStats.averageDeliveryTime.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate:</span>
                      <span className="font-medium">{emailStats.successRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed Emails:</span>
                      <span className="font-medium">{emailStats.failedEmails}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">System Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>SMTP Service:</span>
                      {getHealthBadge(systemHealth.smtpStatus)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Email Queue:</span>
                      {getHealthBadge(systemHealth.queueHealth)}
                    </div>
                    <div className="flex justify-between">
                      <span>Queued Emails:</span>
                      <span className="font-medium">{emailStats.queuedEmails}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};