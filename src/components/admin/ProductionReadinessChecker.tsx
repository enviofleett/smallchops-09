import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export const ProductionReadinessChecker = () => {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const runProductionChecks = async () => {
    setIsChecking(true);
    const checkResults: CheckResult[] = [];

    try {
      // Check SMTP Configuration
      const { data: smtpSettings } = await supabase
        .from('communication_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!smtpSettings || !smtpSettings.smtp_host) {
        checkResults.push({
          name: 'SMTP Configuration',
          status: 'fail',
          message: 'SMTP settings not configured',
          details: 'Configure SMTP settings in Settings > Email System'
        });
      } else {
        checkResults.push({
          name: 'SMTP Configuration',
          status: 'pass',
          message: 'SMTP settings configured'
        });
      }

      // Check Email Queue Processing
      const { data: queuedEmails } = await supabase
        .from('communication_events')
        .select('status')
        .eq('status', 'queued')
        .limit(1);

      if (queuedEmails && queuedEmails.length > 10) {
        checkResults.push({
          name: 'Email Queue',
          status: 'warning',
          message: 'Large queue backlog detected',
          details: 'Consider processing the queue manually'
        });
      } else {
        checkResults.push({
          name: 'Email Queue',
          status: 'pass',
          message: 'Email queue is healthy'
        });
      }

      // Check for Template Key Mapping
      const { data: nullTemplateEvents } = await supabase
        .from('communication_events')
        .select('id')
        .is('template_key', null)
        .limit(1);

      if (nullTemplateEvents && nullTemplateEvents.length > 0) {
        checkResults.push({
          name: 'Template Key Mapping',
          status: 'fail',
          message: 'Events with null template keys found',
          details: 'Run data migration to fix template key mapping'
        });
      } else {
        checkResults.push({
          name: 'Template Key Mapping',
          status: 'pass',
          message: 'All events have proper template keys'
        });
      }

      // Test SMTP Connection
      try {
        const { data: testResult, error } = await supabase.functions.invoke('smtp-health-monitor');
        
        if (error || !testResult?.healthy) {
          checkResults.push({
            name: 'SMTP Connection',
            status: 'fail',
            message: 'SMTP connection test failed',
            details: testResult?.error || error?.message
          });
        } else {
          checkResults.push({
            name: 'SMTP Connection',
            status: 'pass',
            message: 'SMTP connection healthy'
          });
        }
      } catch (error) {
        checkResults.push({
          name: 'SMTP Connection',
          status: 'warning',
          message: 'Could not test SMTP connection',
          details: 'Check manually or verify edge function deployment'
        });
      }

      // Check Business Settings (admin access to business_settings)
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!businessSettings?.name) {
        checkResults.push({
          name: 'Business Configuration',
          status: 'warning',
          message: 'Business name not configured',
          details: 'Set business name in Settings for better email templates'
        });
      } else {
        checkResults.push({
          name: 'Business Configuration',
          status: 'pass',
          message: 'Business settings configured'
        });
      }

      setResults(checkResults);

      const failed = checkResults.filter(r => r.status === 'fail').length;
      const warnings = checkResults.filter(r => r.status === 'warning').length;

      if (failed === 0 && warnings === 0) {
        toast({
          title: '🚀 Production Ready!',
          description: 'All checks passed. System is ready for deployment.',
        });
      } else if (failed === 0) {
        toast({
          title: '⚠️ Minor Issues',
          description: `${warnings} warning(s) found. System can be deployed with caution.`,
        });
      } else {
        toast({
          title: '❌ Critical Issues',
          description: `${failed} critical issue(s) must be fixed before deployment.`,
          variant: 'destructive',
        });
      }

    } catch (error) {
      toast({
        title: 'Check Failed',
        description: 'Failed to run production readiness checks',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (status: CheckResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: CheckResult['status']) => {
    const variants = {
      pass: 'default',
      fail: 'destructive',
      warning: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Production Readiness Checker
          <Button 
            onClick={runProductionChecks} 
            disabled={isChecking}
            size="sm"
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              'Run Checks'
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <p className="text-muted-foreground">
            Click "Run Checks" to verify production readiness
          </p>
        ) : (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex items-start space-x-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <div className="font-medium">{result.name}</div>
                    <div className="text-sm text-muted-foreground">{result.message}</div>
                    {result.details && (
                      <div className="text-xs text-muted-foreground mt-1">{result.details}</div>
                    )}
                  </div>
                </div>
                {getStatusBadge(result.status)}
              </div>
            ))}
            
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">Summary</div>
              <div className="text-sm text-muted-foreground">
                {results.filter(r => r.status === 'pass').length} passed, 
                {results.filter(r => r.status === 'warning').length} warnings, 
                {results.filter(r => r.status === 'fail').length} failed
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};