import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, Shield, Activity, Settings, MessageSquare, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProductionCheck {
  id: string;
  category: 'security' | 'configuration' | 'connectivity' | 'functionality';
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'checking';
  message: string;
  icon: React.ReactNode;
  critical: boolean;
}

export const SMSProductionStatus = () => {
  const [checks, setChecks] = useState<ProductionCheck[]>([]);
  const [overallStatus, setOverallStatus] = useState<'pass' | 'warn' | 'fail' | 'checking'>('checking');
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();

  const initialChecks: ProductionCheck[] = [
    {
      id: 'credentials',
      category: 'security',
      name: 'MySMSTab Credentials',
      status: 'checking',
      message: 'Validating MySMSTab API credentials',
      icon: <Key className="h-4 w-4" />,
      critical: true,
    },
    {
      id: 'configuration',
      category: 'configuration',
      name: 'SMS Configuration',
      status: 'checking',
      message: 'Checking SMS provider configuration',
      icon: <Settings className="h-4 w-4" />,
      critical: true,
    },
    {
      id: 'templates',
      category: 'functionality',
      name: 'SMS Templates',
      status: 'checking',
      message: 'Validating active SMS templates',
      icon: <MessageSquare className="h-4 w-4" />,
      critical: false,
    },
    {
      id: 'connectivity',
      category: 'connectivity',
      name: 'API Connectivity',
      status: 'checking',
      message: 'Testing MySMSTab API connection',
      icon: <Activity className="h-4 w-4" />,
      critical: true,
    },
    {
      id: 'balance',
      category: 'functionality',
      name: 'Account Balance',
      status: 'checking',
      message: 'Checking MySMSTab account balance',
      icon: <Shield className="h-4 w-4" />,
      critical: false,
    },
  ];

  useEffect(() => {
    setChecks(initialChecks);
    runProductionChecks();
  }, []);

  const runProductionChecks = async () => {
    setChecking(true);
    const updatedChecks = [...initialChecks];

    try {
      // Check 1: SMS Configuration exists and is active
      const configResult = await checkSMSConfiguration();
      updateCheck(updatedChecks, 'configuration', configResult);

      // Check 2: Active SMS Templates exist
      const templatesResult = await checkSMSTemplates();
      updateCheck(updatedChecks, 'templates', templatesResult);

      // Check 3: Test API connectivity and credentials
      const connectivityResult = await checkAPIConnectivity();
      updateCheck(updatedChecks, 'connectivity', connectivityResult);
      updateCheck(updatedChecks, 'credentials', connectivityResult);

      // Check 4: Check account balance
      const balanceResult = await checkAccountBalance();
      updateCheck(updatedChecks, 'balance', balanceResult);

      // Update overall status
      const criticalFails = updatedChecks.filter(c => c.critical && c.status === 'fail');
      const anyFails = updatedChecks.filter(c => c.status === 'fail');
      const anyWarns = updatedChecks.filter(c => c.status === 'warn');

      if (criticalFails.length > 0) {
        setOverallStatus('fail');
      } else if (anyFails.length > 0 || anyWarns.length > 0) {
        setOverallStatus('warn');
      } else {
        setOverallStatus('pass');
      }

      setChecks(updatedChecks);
      
    } catch (error) {
      console.error('Production checks failed:', error);
      toast({
        title: 'Production Check Failed',
        description: 'Unable to complete all production readiness checks',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  const updateCheck = (checks: ProductionCheck[], id: string, result: { status: 'pass' | 'warn' | 'fail'; message: string }) => {
    const checkIndex = checks.findIndex(c => c.id === id);
    if (checkIndex >= 0) {
      checks[checkIndex] = { ...checks[checkIndex], status: result.status, message: result.message };
    }
  };

  const checkSMSConfiguration = async (): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string }> => {
    try {
      const { data, error } = await supabase
        .from('sms_configuration')
        .select('*')
        .eq('provider', 'mysmstab')
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return { status: 'fail', message: 'No active SMS configuration found' };
      }

      if (!data.sender_id || data.sender_id.trim() === '') {
        return { status: 'warn', message: 'Sender ID not configured' };
      }

      return { status: 'pass', message: `Active configuration with sender ID: ${data.sender_id}` };
    } catch (error) {
      return { status: 'fail', message: 'Failed to check SMS configuration' };
    }
  };

  const checkSMSTemplates = async (): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string }> => {
    try {
      const { data, error } = await supabase
        .from('sms_templates')
        .select('template_key, is_active')
        .eq('is_active', true);

      if (error) {
        return { status: 'fail', message: 'Failed to check SMS templates' };
      }

      const activeTemplates = data?.length || 0;
      
      if (activeTemplates === 0) {
        return { status: 'warn', message: 'No active SMS templates found' };
      }

      const hasOrderTemplates = data?.some(t => 
        t.template_key.includes('order_') || 
        t.template_key.includes('confirmed') || 
        t.template_key.includes('delivered')
      );

      if (!hasOrderTemplates) {
        return { status: 'warn', message: `${activeTemplates} templates found, but no order templates` };
      }

      return { status: 'pass', message: `${activeTemplates} active templates including order notifications` };
    } catch (error) {
      return { status: 'fail', message: 'Failed to check SMS templates' };
    }
  };

  const checkAPIConnectivity = async (): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('sms-service', {
        body: { action: 'check_balance' }
      });

      if (error) {
        if (error.message?.includes('credentials')) {
          return { status: 'fail', message: 'MySMSTab credentials not configured' };
        }
        return { status: 'fail', message: `API connectivity failed: ${error.message}` };
      }

      if (data?.success) {
        return { status: 'pass', message: 'MySMSTab API connection successful' };
      } else {
        return { status: 'fail', message: data?.error || 'API connection failed' };
      }
    } catch (error) {
      return { status: 'fail', message: 'Network connectivity issue' };
    }
  };

  const checkAccountBalance = async (): Promise<{ status: 'pass' | 'warn' | 'fail'; message: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('sms-service', {
        body: { action: 'check_balance' }
      });

      if (error) {
        console.error('SMS balance check error:', error);
        return { status: 'fail', message: `Balance check failed: ${error.message}` };
      }

      if (!data?.success) {
        console.error('SMS balance check unsuccessful:', data);
        return { status: 'fail', message: data?.error || 'Balance check unsuccessful' };
      }

      // Parse balance from MySMSTab API response - handle different formats
      let balance = 0;
      if (typeof data.balance === 'number') {
        balance = data.balance;
      } else if (typeof data.credits === 'number') {
        balance = data.credits;
      } else if (typeof data.balance === 'string') {
        balance = parseFloat(data.balance) || 0;
      } else if (data.data && typeof data.data.balance === 'number') {
        balance = data.data.balance;
      }
      
      if (balance <= 0) {
        return { status: 'fail', message: 'Account balance is empty (₦0) - Top up required' };
      } else if (balance < 50) {
        return { status: 'warn', message: `Low balance: ₦${balance.toLocaleString()} - Consider topping up` };
      } else {
        return { status: 'pass', message: `Live balance: ₦${balance.toLocaleString()} - MySMSTab Account` };
      }
    } catch (error) {
      console.error('Balance check network error:', error);
      return { status: 'fail', message: 'Network error checking live balance' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'warn':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'checking':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-success text-success-foreground">✓ Pass</Badge>;
      case 'warn':
        return <Badge variant="secondary" className="bg-warning text-warning-foreground">⚠ Warning</Badge>;
      case 'fail':
        return <Badge variant="destructive">✗ Fail</Badge>;
      case 'checking':
        return <Badge variant="outline">⟳ Checking...</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getOverallBadge = () => {
    switch (overallStatus) {
      case 'pass':
        return <Badge variant="default" className="bg-success text-success-foreground">🚀 Production Ready</Badge>;
      case 'warn':
        return <Badge variant="secondary" className="bg-warning text-warning-foreground">⚠️ Needs Attention</Badge>;
      case 'fail':
        return <Badge variant="destructive">❌ Not Ready</Badge>;
      default:
        return <Badge variant="outline">⟳ Checking...</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              SMS Production Readiness
            </CardTitle>
            <CardDescription>
              Comprehensive checks for live production deployment
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getOverallBadge()}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runProductionChecks}
              disabled={checking}
            >
              {checking ? 'Checking...' : 'Re-run Checks'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checks.map((check) => (
            <div key={check.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex-shrink-0">
                {getStatusIcon(check.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    {check.icon}
                    {check.name}
                    {check.critical && <Badge variant="outline" className="text-xs">Critical</Badge>}
                  </h4>
                  {getStatusBadge(check.status)}
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {check.message}
                </p>
              </div>
            </div>
          ))}
        </div>

        {overallStatus === 'pass' && (
          <div className="mt-6 p-4 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <h4 className="font-semibold text-success">🎉 Production Ready!</h4>
            </div>
            <p className="text-sm text-success">
              Your SMS integration has passed all critical production readiness checks. 
              You can safely deploy this to your live environment.
            </p>
          </div>
        )}

        {overallStatus === 'fail' && (
          <div className="mt-6 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <h4 className="font-semibold text-destructive">⛔ Not Ready for Production</h4>
            </div>
            <p className="text-sm text-destructive">
              Critical issues detected. Please resolve the failed checks above before deploying to production.
            </p>
          </div>
        )}

        {overallStatus === 'warn' && (
          <div className="mt-6 p-4 bg-warning/10 rounded-lg border border-warning/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h4 className="font-semibold text-warning">⚠️ Review Required</h4>
            </div>
            <p className="text-sm text-warning">
              Some issues detected that should be addressed before full production deployment.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};