import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle,
  Mail,
  Database,
  Settings
} from 'lucide-react';

interface TemplateStatus {
  key: string;
  name: string;
  exists: boolean;
  active: boolean;
  critical: boolean;
  lastUsed?: string;
}

export const ProductionEmailStatus: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [templateStatuses, setTemplateStatuses] = useState<TemplateStatus[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [smtpHealth, setSmtpHealth] = useState<any>(null);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const { toast } = useToast();

  // Core templates that should exist in production
  const requiredTemplates = [
    { key: 'order_confirmation', name: 'Order Confirmation', critical: true },
    { key: 'order_status_update', name: 'Order Status Update', critical: true },
    { key: 'order_preparing', name: 'Order Preparing', critical: true },
    { key: 'order_ready', name: 'Order Ready for Pickup', critical: true },
    { key: 'out_for_delivery', name: 'Out for Delivery', critical: true },
    { key: 'customer_welcome', name: 'Customer Welcome', critical: false },
    { key: 'admin_status_update', name: 'Admin Status Update', critical: true }
  ];

  // Branded fallback whitelist (matches server-side configuration)
  const brandedFallbackWhitelist = [
    'order_status_update',
    'order_confirmation', 
    'order_preparing',
    'order_ready',
    'out_for_delivery',
    'customer_welcome',
    'admin_status_update'
  ];

  const testSMTPConnection = async () => {
    try {
      setIsTestingSmtp(true);
      
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: { healthcheck: true, check: 'credentials' }
      });
      
      if (error) throw error;
      
      setSmtpHealth(data);
      
      toast({
        title: "SMTP Test Complete",
        description: data.status === 'healthy' ? "SMTP connection is configured correctly" : "SMTP configuration has issues",
        variant: data.status === 'healthy' ? "default" : "destructive"
      });
    } catch (error: any) {
      console.error('SMTP test failed:', error);
      setSmtpHealth({ status: 'error', error: error.message });
      toast({
        title: "SMTP Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const checkProductionReadiness = async () => {
    try {
      setIsLoading(true);

      // Check template availability
      const templateResults = await Promise.all(
        requiredTemplates.map(async (template) => {
          const { data, error } = await supabase
            .from('enhanced_email_templates')
            .select('template_name, is_active, updated_at')
            .eq('template_key', template.key)
            .maybeSingle();

          return {
            key: template.key,
            name: template.name,
            exists: !!data,
            active: data?.is_active || false,
            critical: template.critical,
            lastUsed: data?.updated_at
          };
        })
      );

      setTemplateStatuses(templateResults);

      // Check email system health
      const { data: healthData, error: healthError } = await supabase.functions.invoke('unified-smtp-sender', {
        method: 'GET'
      });

      if (!healthError && healthData) {
        setSystemHealth(healthData);
      }

    } catch (error: any) {
      console.error('Error checking production readiness:', error);
      toast({
        title: "Health Check Failed",
        description: "Failed to check production email status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkProductionReadiness();
  }, []);

  const criticalIssues = templateStatuses.filter(t => t.critical && (!t.exists || !t.active));
  const isProductionReady = criticalIssues.length === 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Shield className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Checking production email status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Production Email System Status</CardTitle>
          </div>
          <CardDescription>
            Email template readiness and system health for live production
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {isProductionReady ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Production Ready</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Issues Found</span>
              </div>
            )}
            
            <Badge variant={isProductionReady ? "default" : "destructive"}>
              {criticalIssues.length} Critical Issues
            </Badge>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkProductionReadiness}
            >
              Refresh Status
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={testSMTPConnection}
              disabled={isTestingSmtp}
            >
              {isTestingSmtp ? 'Testing SMTP...' : 'Test SMTP'}
            </Button>
          </div>

          {!isProductionReady && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-700">
                <strong>Production Not Ready:</strong> {criticalIssues.length} critical email templates are missing or inactive. 
                All customer-facing emails will fail until these templates are created and activated.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Template Status Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templateStatuses.map((template) => (
          <Card key={template.key} className={template.critical && !template.active ? 'border-red-200' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                <div className="flex gap-1">
                  {template.critical && (
                    <Badge variant="outline" className="text-xs">Critical</Badge>
                  )}
                  <Badge variant={template.exists && template.active ? "default" : "secondary"}>
                    {template.exists ? (template.active ? 'Active' : 'Inactive') : 'Missing'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {template.exists ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-muted-foreground">
                    Template Key: <code>{template.key}</code>
                  </span>
                </div>
                
                {template.exists && (
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground">
                      Status: {template.active ? 'Ready for use' : 'Needs activation'}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Health */}
      {(systemHealth || smtpHealth) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Email System Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* System Health */}
              {systemHealth && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium mb-2">Service Status</p>
                    <Badge variant="default">{systemHealth.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Implementation</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{systemHealth.implementation}</code>
                  </div>
                </div>
              )}
              
              {/* SMTP Health */}
              {smtpHealth && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">SMTP Configuration Status</p>
                    <Badge variant={smtpHealth.status === 'healthy' ? 'default' : 'destructive'}>
                      {smtpHealth.status}
                    </Badge>
                  </div>
                  
                  {smtpHealth.credentials && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Host:</span> {smtpHealth.credentials.SMTP_HOST}
                      </div>
                      <div>
                        <span className="font-medium">Port:</span> {smtpHealth.credentials.SMTP_PORT}
                      </div>
                      <div>
                        <span className="font-medium">Username:</span> {smtpHealth.credentials.SMTP_USERNAME?.split('@')[0]}@***
                      </div>
                      <div>
                        <span className="font-medium">From:</span> {smtpHealth.credentials.SMTP_FROM_EMAIL?.split('@')[0]}@***
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Source:</span> 
                        <Badge variant="outline" className="ml-2">
                          {smtpHealth.source}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  {smtpHealth.error && (
                    <div className="mt-3 p-3 bg-destructive/10 rounded border border-destructive/20">
                      <p className="text-sm text-destructive font-medium">SMTP Configuration Error:</p>
                      <p className="text-sm text-destructive">{smtpHealth.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Branded Fallback Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Branded Fallback Configuration</CardTitle>
          </div>
          <CardDescription>
            Production-safe fallback templates for missing database templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Branded Fallback Enabled
              </Badge>
              <span className="text-sm text-muted-foreground">
                Whitelisted templates can use curated fallbacks in production
              </span>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Whitelisted Templates ({brandedFallbackWhitelist.length})</p>
              <div className="flex flex-wrap gap-1">
                {brandedFallbackWhitelist.map((templateKey) => {
                  const templateStatus = templateStatuses.find(t => t.key === templateKey);
                  const hasDatabaseTemplate = templateStatus?.exists && templateStatus?.active;
                  
                  return (
                    <Badge 
                      key={templateKey} 
                      variant={hasDatabaseTemplate ? "default" : "outline"}
                      className="text-xs"
                    >
                      {templateKey}
                      {!hasDatabaseTemplate && (
                        <span className="ml-1 text-amber-600">*</span>
                      )}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                * Templates marked with asterisk will use branded fallbacks
              </p>
            </div>
            
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                <strong>Branded Fallback Mode:</strong> Missing templates on the whitelist will use curated branded fallbacks instead of failing. 
                For best results, create actual templates in the Email Template Manager.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Production Mode Information */}
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          <strong>Production Email System:</strong> Templates are prioritized from (1) Email Template Manager database, 
          (2) Branded Fallback Library for whitelisted templates, (3) System will reject non-whitelisted missing templates. 
          This ensures consistent branding while maintaining reliability.
        </AlertDescription>
      </Alert>
    </div>
  );
};