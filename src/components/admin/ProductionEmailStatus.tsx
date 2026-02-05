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
  const { toast } = useToast();

  // Core templates that should exist in production
  const requiredTemplates = [
    { key: 'order_confirmation', name: 'Order Confirmation', critical: true },
    { key: 'order_delivered', name: 'Order Delivered', critical: true },
    { key: 'order_out_for_delivery', name: 'Out for Delivery', critical: true },
    { key: 'shipping_notification', name: 'Shipping Notification', critical: true },
    { key: 'order_ready', name: 'Order Ready for Pickup', critical: true },
    { key: 'customer_welcome', name: 'Customer Welcome', critical: false },
    { key: 'payment_confirmation', name: 'Payment Confirmation', critical: true }
  ];

  const checkProductionReadiness = async () => {
    try {
      setIsLoading(true);

      // Check template availability
      const templateResults = await Promise.all(
        requiredTemplates.map(async (template) => {
          const { data, error } = await (supabase as any)
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

      // Check email system health using the standardized healthcheck
      const { data: healthData, error: healthError } = await supabase.functions.invoke('smtp-auth-healthcheck', {
        method: 'POST'
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
      {systemHealth && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Email System Health</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Production Mode Information */}
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          <strong>Production Mode Active:</strong> All email communications must use templates from the Email Template Manager. 
          Direct email content and fallback templates are disabled to ensure consistent branding and prevent unauthorized messages.
        </AlertDescription>
      </Alert>
    </div>
  );
};