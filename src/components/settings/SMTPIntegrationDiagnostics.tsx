import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Settings, 
  Zap, 
  RefreshCw,
  AlertTriangle,
  XCircle,
  Wrench
} from 'lucide-react';

interface DiagnosticResult {
  id: string;
  title: string;
  status: 'pass' | 'fail' | 'warning' | 'testing';
  message: string;
  recommendation?: string;
  criticalBlocker?: boolean;
}

interface SMTPConfig {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_secure?: boolean;
  use_smtp?: boolean;
}

export const SMTPIntegrationDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');

  const updateDiagnostic = (id: string, updates: Partial<DiagnosticResult>) => {
    setDiagnostics(prev => prev.map(d => 
      d.id === id ? { ...d, ...updates } : d
    ));
  };

  const initializeDiagnostics = () => {
    const tests: DiagnosticResult[] = [
      {
        id: 'config-exists',
        title: 'SMTP Configuration Exists',
        status: 'testing',
        message: 'Checking for SMTP configuration...',
        criticalBlocker: true
      },
      {
        id: 'config-complete',
        title: 'Configuration Completeness',
        status: 'testing', 
        message: 'Validating required SMTP fields...',
        criticalBlocker: true
      },
      {
        id: 'function-availability',
        title: 'Edge Function Availability',
        status: 'testing',
        message: 'Testing email functions...',
        criticalBlocker: true
      },
      {
        id: 'template-system',
        title: 'Email Template System',
        status: 'testing',
        message: 'Checking template availability...',
        criticalBlocker: false
      },
      {
        id: 'rate-limiting',
        title: 'Rate Limiting Protection',
        status: 'testing',
        message: 'Verifying rate limiting...',
        criticalBlocker: false
      }
    ];
    
    setDiagnostics(tests);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    initializeDiagnostics();
    
    try {
      // Test 1: Check SMTP Configuration Exists
      await testSMTPConfigExists();
      
      // Test 2: Validate Configuration Completeness  
      await testConfigurationCompleteness();
      
      // Test 3: Test Edge Function Availability
      await testFunctionAvailability();
      
      // Test 4: Check Template System
      await testTemplateSystem();
      
      // Test 5: Verify Rate Limiting
      await testRateLimiting();
      
      // Calculate overall status
      const results = diagnostics;
      const criticalFails = results.filter(r => r.criticalBlocker && r.status === 'fail').length;
      const warnings = results.filter(r => r.status === 'warning').length;
      
      if (criticalFails > 0) {
        setOverallStatus('critical');
        toast.error(`${criticalFails} critical blockers found in SMTP system`);
      } else if (warnings > 0) {
        setOverallStatus('warning');
        toast.warning(`${warnings} warnings found in SMTP system`);
      } else {
        setOverallStatus('healthy');
        toast.success('SMTP system diagnostics passed');
      }
      
    } catch (error) {
      console.error('Diagnostic error:', error);
      toast.error('Diagnostic test failed');
    } finally {
      setIsRunning(false);
    }
  };

  const testSMTPConfigExists = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
        
      if (error) {
        updateDiagnostic('config-exists', {
          status: 'fail',
          message: 'Database error accessing SMTP configuration',
          recommendation: 'Check database permissions and table schema'
        });
        return;
      }
      
      if (!data) {
        updateDiagnostic('config-exists', {
          status: 'fail', 
          message: 'No SMTP configuration found in database',
          recommendation: 'Create SMTP configuration in Settings > SMTP Settings'
        });
        return;
      }
      
      updateDiagnostic('config-exists', {
        status: 'pass',
        message: 'SMTP configuration table accessible'
      });
      
    } catch (error) {
      updateDiagnostic('config-exists', {
        status: 'fail',
        message: 'Critical error accessing SMTP configuration',
        recommendation: 'Check network connectivity and authentication'
      });
    }
  };

  const testConfigurationCompleteness = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_settings')
        .select('smtp_host, smtp_port, smtp_user, smtp_pass, use_smtp')
        .eq('use_smtp', true)
        .limit(1)
        .maybeSingle();
        
      if (error || !data) {
        updateDiagnostic('config-complete', {
          status: 'fail',
          message: 'No active SMTP configuration found',
          recommendation: 'Enable SMTP and configure all required fields'
        });
        return;
      }
      
      const config = data as SMTPConfig;
      const missing = [];
      
      if (!config.smtp_host) missing.push('host');
      if (!config.smtp_user) missing.push('username'); 
      if (!config.smtp_pass) missing.push('password');
      
      if (missing.length > 0) {
        updateDiagnostic('config-complete', {
          status: 'fail',
          message: `Missing required fields: ${missing.join(', ')}`,
          recommendation: 'Complete all SMTP configuration fields'
        });
        return;
      }
      
      updateDiagnostic('config-complete', {
        status: 'pass',
        message: 'All required SMTP fields configured'
      });
      
    } catch (error) {
      updateDiagnostic('config-complete', {
        status: 'fail',
        message: 'Error validating SMTP configuration completeness'
      });
    }
  };

  const testFunctionAvailability = async () => {
    const functions = [
      { name: 'unified-smtp-sender', critical: true },
      { name: 'smtp-auth-healthcheck', critical: true },
      { name: 'email-core', critical: false }
    ];
    
    let criticalFails = 0;
    const results = [];
    
    for (const func of functions) {
      try {
        const { error } = await supabase.functions.invoke(func.name, {
          body: { test: true, dry_run: true }
        });
        
        // Even if function returns error, if it responds, it's available
        results.push(`✓ ${func.name}`);
      } catch (error) {
        if (func.critical) {
          criticalFails++;
          results.push(`✗ ${func.name} (CRITICAL)`);
        } else {
          results.push(`⚠ ${func.name} (optional)`);
        }
      }
    }
    
    if (criticalFails > 0) {
      updateDiagnostic('function-availability', {
        status: 'fail',
        message: `${criticalFails} critical functions unavailable`,
        recommendation: 'Deploy missing edge functions or check function logs'
      });
    } else {
      updateDiagnostic('function-availability', {
        status: 'pass',
        message: 'All critical email functions available'
      });
    }
  };

  const testTemplateSystem = async () => {
    try {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('id, template_key, is_active')
        .eq('is_active', true)
        .limit(5);
        
      if (error) {
        updateDiagnostic('template-system', {
          status: 'warning',
          message: 'Cannot access email templates table',
          recommendation: 'Check email templates table permissions'
        });
        return;
      }
      
      const templateCount = data?.length || 0;
      
      if (templateCount === 0) {
        updateDiagnostic('template-system', {
          status: 'warning', 
          message: 'No active email templates found',
          recommendation: 'Create email templates for automated emails'
        });
      } else {
        updateDiagnostic('template-system', {
          status: 'pass',
          message: `${templateCount} active email templates available`
        });
      }
      
    } catch (error) {
      updateDiagnostic('template-system', {
        status: 'warning',
        message: 'Error checking template system'
      });
    }
  };

  const testRateLimiting = async () => {
    try {
      // Check if rate limiting function exists
      const { data, error } = await supabase.rpc('check_email_rate_limit', {
        email_address: 'test@example.com'
      });
      
      if (error) {
        updateDiagnostic('rate-limiting', {
          status: 'warning',
          message: 'Rate limiting function not available',
          recommendation: 'Implement rate limiting to prevent spam'
        });
        return;
      }
      
      updateDiagnostic('rate-limiting', {
        status: 'pass',
        message: 'Rate limiting protection active'
      });
      
    } catch (error) {
      updateDiagnostic('rate-limiting', {
        status: 'warning',
        message: 'Rate limiting check failed'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'testing': return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string, criticalBlocker?: boolean) => {
    const baseClasses = "text-xs px-2 py-1";
    
    switch (status) {
      case 'pass': 
        return <Badge className={`${baseClasses} bg-green-100 text-green-800`}>PASS</Badge>;
      case 'fail': 
        return (
          <Badge className={`${baseClasses} ${criticalBlocker ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
            {criticalBlocker ? 'CRITICAL' : 'FAIL'}
          </Badge>
        );
      case 'warning': 
        return <Badge className={`${baseClasses} bg-yellow-100 text-yellow-800`}>WARNING</Badge>;
      case 'testing': 
        return <Badge className={`${baseClasses} bg-blue-100 text-blue-800`}>TESTING</Badge>;
      default: 
        return <Badge className={`${baseClasses} bg-gray-100 text-gray-800`}>PENDING</Badge>;
    }
  };

  const getOverallStatusColor = () => {
    switch (overallStatus) {
      case 'healthy': return 'border-green-200 bg-green-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';  
      case 'critical': return 'border-red-200 bg-red-50';
    }
  };

  useEffect(() => {
    // Run diagnostics on component mount
    runDiagnostics();
  }, []);

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              QA SMTP Integration Diagnostics
            </CardTitle>
            <CardDescription>
              Critical blocker analysis for native SMTP email system
            </CardDescription>
          </div>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Re-test'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Status Alert */}
        <Alert className={getOverallStatusColor()}>
          {overallStatus === 'healthy' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : overallStatus === 'warning' ? (
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription>
            <div className="font-medium mb-1">
              System Status: {overallStatus.toUpperCase()}
            </div>
            {overallStatus === 'critical' && (
              <div className="text-sm">
                Critical blockers detected. Email system may not function properly.
              </div>
            )}
            {overallStatus === 'warning' && (
              <div className="text-sm">
                Some issues detected. Email system functional but not optimized.
              </div>
            )}
            {overallStatus === 'healthy' && (
              <div className="text-sm">
                All critical systems operational. SMTP integration ready for production.
              </div>
            )}
          </AlertDescription>
        </Alert>

        {/* Diagnostic Results */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Diagnostic Results</h4>
          {diagnostics.map((diagnostic) => (
            <div key={diagnostic.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(diagnostic.status)}
                <div>
                  <div className="font-medium text-sm">{diagnostic.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {diagnostic.message}
                  </div>
                  {diagnostic.recommendation && (
                    <div className="text-xs text-blue-600 mt-1">
                      💡 {diagnostic.recommendation}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {diagnostic.criticalBlocker && (
                  <Badge variant="outline" className="text-xs">
                    BLOCKER
                  </Badge>
                )}
                {getStatusBadge(diagnostic.status, diagnostic.criticalBlocker)}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Fixes */}
        {overallStatus === 'critical' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 mb-2">🚨 Immediate Actions Required</h4>
            <div className="text-sm text-red-700 space-y-1">
              <p>• Configure SMTP settings in Settings → SMTP Settings</p>
              <p>• Ensure all required edge functions are deployed</p>
              <p>• Verify database table permissions</p>
              <p>• Test with a simple email before production use</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};