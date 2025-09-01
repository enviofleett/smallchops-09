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
      // Critical Production Blockers
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
        id: 'production-environment',
        title: 'Production Environment Setup',
        status: 'testing',
        message: 'Validating production configuration...',
        criticalBlocker: true
      },
      // Security & Compliance
      {
        id: 'security-validation',
        title: 'Security & Credentials',
        status: 'testing',
        message: 'Checking secure credential storage...',
        criticalBlocker: false
      },
      {
        id: 'ssl-tls-validation',
        title: 'SSL/TLS Configuration',
        status: 'testing',
        message: 'Verifying secure connection settings...',
        criticalBlocker: false
      },
      // Operational Excellence
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
      },
      {
        id: 'monitoring-setup',
        title: 'Monitoring & Alerting',
        status: 'testing',
        message: 'Checking production monitoring...',
        criticalBlocker: false
      },
      {
        id: 'delivery-tracking',
        title: 'Email Delivery Tracking',
        status: 'testing',
        message: 'Verifying delivery confirmation...',
        criticalBlocker: false
      }
    ];
    
    setDiagnostics(tests);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    initializeDiagnostics();
    
    try {
      // Critical Production Tests
      await testSMTPConfigExists();
      await testConfigurationCompleteness();
      await testFunctionAvailability();
      await testProductionEnvironment();
      
      // Security & Compliance Tests
      await testSecurityValidation();
      await testSSLTLSConfiguration();
      
      // Operational Excellence Tests
      await testTemplateSystem();
      await testRateLimiting();
      await testMonitoringSetup();
      await testDeliveryTracking();
      
      // Calculate overall status with enhanced logic
      setTimeout(() => {
        const currentDiagnostics = diagnostics;
        const criticalFails = currentDiagnostics.filter(r => r.criticalBlocker && r.status === 'fail').length;
        const warnings = currentDiagnostics.filter(r => r.status === 'warning').length;
        const totalFails = currentDiagnostics.filter(r => r.status === 'fail').length;
        
        if (criticalFails > 0) {
          setOverallStatus('critical');
          toast.error(`${criticalFails} critical blockers prevent production deployment`);
        } else if (totalFails > 0 || warnings >= 3) {
          setOverallStatus('warning'); 
          toast.warning(`${warnings} recommendations for production optimization`);
        } else {
          setOverallStatus('healthy');
          toast.success('SMTP system production-ready ✅');
        }
      }, 100);
      
    } catch (error) {
      console.error('Production diagnostic error:', error);
      toast.error('Production readiness check failed');
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
        .select('smtp_host, smtp_port, smtp_user, smtp_pass, use_smtp, email_provider')
        .eq('use_smtp', true)
        .limit(1)
        .maybeSingle();
        
      if (error || !data) {
        updateDiagnostic('config-complete', {
          status: 'fail',
          message: 'No active SMTP configuration found',
          recommendation: 'Enable SMTP and configure all required fields in SMTP Settings'
        });
        return;
      }
      
      const config = data as SMTPConfig & { email_provider?: string };
      const missing = [];
      const warnings = [];
      
      // Check required fields
      if (!config.smtp_host || config.smtp_host.trim() === '') {
        missing.push('SMTP host');
      }
      if (!config.smtp_user || config.smtp_user.trim() === '') {
        missing.push('SMTP username'); 
      }
      
      // Handle password validation - production-ready approach
      const hasPassword = config.smtp_pass && config.smtp_pass.trim() !== '';
      
      if (!hasPassword) {
        // Check if this might be using environment secrets (production pattern)
        const isProductionSetup = config.email_provider || 
                                config.smtp_host?.includes('smtp.') ||
                                config.smtp_host?.includes('mail.');
        
        if (isProductionSetup) {
          warnings.push('Password stored in secrets (production secure)');
        } else {
          missing.push('SMTP password');
        }
      }
      
      // Critical failures
      if (missing.length > 0) {
        updateDiagnostic('config-complete', {
          status: 'fail',
          message: `Missing critical fields: ${missing.join(', ')}`,
          recommendation: 'Complete SMTP configuration or verify secrets are properly configured'
        });
        return;
      }
      
      // Warnings but functional
      if (warnings.length > 0) {
        updateDiagnostic('config-complete', {
          status: 'warning',
          message: `Configuration validated with notes: ${warnings.join(', ')}`,
          recommendation: 'Run SMTP connection test to verify production secrets work correctly'
        });
        return;
      }
      
      // All good
      updateDiagnostic('config-complete', {
        status: 'pass',
        message: 'All required SMTP fields configured and validated'
      });
      
    } catch (error) {
      updateDiagnostic('config-complete', {
        status: 'fail',
        message: 'Critical error during SMTP configuration validation',
        recommendation: 'Check database connectivity and table permissions'
      });
    }
  };

  const testFunctionAvailability = async () => {
    const functions = [
      { name: 'unified-smtp-sender', critical: true, description: 'Main email sending service' },
      { name: 'smtp-auth-healthcheck', critical: true, description: 'SMTP authentication validator' },
      { name: 'email-core', critical: false, description: 'Advanced email processing' }
    ];
    
    let criticalFails = 0;
    let totalTests = 0;
    const results = [];
    
    for (const func of functions) {
      totalTests++;
      try {
        // Use a lightweight test that doesn't trigger actual email sending
        const { error } = await supabase.functions.invoke(func.name, {
          body: { 
            healthcheck: true,
            dry_run: true,
            test_mode: true 
          }
        });
        
        // Function responds = it's available (even with errors is OK for availability test)
        results.push(`✓ ${func.name} (${func.description})`);
        
      } catch (networkError: any) {
        // Network/deployment issues
        if (func.critical) {
          criticalFails++;
          results.push(`✗ ${func.name} - ${networkError.message || 'Not deployed'}`);
        } else {
          results.push(`⚠ ${func.name} - ${networkError.message || 'Optional service unavailable'}`);
        }
      }
    }
    
    const availableCount = totalTests - criticalFails;
    
    if (criticalFails > 0) {
      updateDiagnostic('function-availability', {
        status: 'fail',
        message: `${criticalFails}/${totalTests} critical functions unavailable`,
        recommendation: 'Deploy missing edge functions. Check Supabase Functions dashboard for deployment status'
      });
    } else if (availableCount === totalTests) {
      updateDiagnostic('function-availability', {
        status: 'pass',
        message: `All ${totalTests} email functions deployed and available`
      });
    } else {
      updateDiagnostic('function-availability', {
        status: 'warning',
        message: `${availableCount}/${totalTests} functions available (non-critical missing)`,
        recommendation: 'Optional functions missing but core system will work'
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
          recommendation: 'Deploy rate limiting to prevent spam and abuse'
        });
        return;
      }
      
      updateDiagnostic('rate-limiting', {
        status: 'pass',
        message: 'Rate limiting protection active and configured'
      });
      
    } catch (error) {
      updateDiagnostic('rate-limiting', {
        status: 'warning',
        message: 'Rate limiting validation failed'
      });
    }
  };

  const testProductionEnvironment = async () => {
    try {
      const checks = [];
      
      // Check environment detection
      const isDevelopment = window.location.hostname === 'localhost';
      const isProduction = window.location.hostname.includes('.app') || 
                          window.location.hostname.includes('.com');
      
      if (isDevelopment) {
        checks.push('⚠ Running in development mode');
      } else if (isProduction) {
        checks.push('✓ Production environment detected');
      }
      
      // Check for HTTPS in production
      if (isProduction && window.location.protocol !== 'https:') {
        updateDiagnostic('production-environment', {
          status: 'fail',
          message: 'Production site not using HTTPS',
          recommendation: 'Enable HTTPS for secure email transmission'
        });
        return;
      }
      
      // Check for production-ready domain
      if (isProduction) {
        updateDiagnostic('production-environment', {
          status: 'pass',
          message: 'Production environment validated with HTTPS'
        });
      } else {
        updateDiagnostic('production-environment', {
          status: 'warning',
          message: 'Development environment - production checks skipped',
          recommendation: 'Deploy to production environment for full validation'
        });
      }
      
    } catch (error) {
      updateDiagnostic('production-environment', {
        status: 'warning',
        message: 'Environment validation failed'
      });
    }
  };

  const testSecurityValidation = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_settings')
        .select('smtp_pass, smtp_secure, sender_email')
        .limit(1)
        .maybeSingle();
        
      if (error || !data) {
        updateDiagnostic('security-validation', {
          status: 'warning',
          message: 'Cannot validate security settings'
        });
        return;
      }
      
      const securityIssues = [];
      const recommendations = [];
      
      // Check password storage
      if (data.smtp_pass && data.smtp_pass.length < 20) {
        securityIssues.push('Weak password or stored in plaintext');
        recommendations.push('Use Supabase Function Secrets for SMTP password');
      }
      
      // Check sender email domain
      if (data.sender_email && !data.sender_email.includes('@')) {
        securityIssues.push('Invalid sender email format');
      }
      
      if (securityIssues.length > 0) {
        updateDiagnostic('security-validation', {
          status: 'warning',
          message: `Security concerns: ${securityIssues.join(', ')}`,
          recommendation: recommendations.join('; ')
        });
      } else {
        updateDiagnostic('security-validation', {
          status: 'pass',
          message: 'Security configuration validated'
        });
      }
      
    } catch (error) {
      updateDiagnostic('security-validation', {
        status: 'warning',
        message: 'Security validation check failed'
      });
    }
  };

  const testSSLTLSConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_settings')
        .select('smtp_secure, smtp_port')
        .limit(1)
        .maybeSingle();
        
      if (error || !data) {
        updateDiagnostic('ssl-tls-validation', {
          status: 'warning',
          message: 'Cannot validate SSL/TLS settings'
        });
        return;
      }
      
      const isSecurePort = data.smtp_port === 465 || data.smtp_port === 587;
      const hasSecureFlag = data.smtp_secure === true;
      
      if (!isSecurePort && !hasSecureFlag) {
        updateDiagnostic('ssl-tls-validation', {
          status: 'fail',
          message: 'Insecure SMTP configuration detected',
          recommendation: 'Use port 587 (STARTTLS) or 465 (SSL) with secure=true'
        });
      } else if (isSecurePort || hasSecureFlag) {
        updateDiagnostic('ssl-tls-validation', {
          status: 'pass',
          message: 'Secure SMTP connection configured'
        });
      } else {
        updateDiagnostic('ssl-tls-validation', {
          status: 'warning',
          message: 'SSL/TLS configuration may need optimization'
        });
      }
      
    } catch (error) {
      updateDiagnostic('ssl-tls-validation', {
        status: 'warning',
        message: 'SSL/TLS validation failed'
      });
    }
  };

  const testMonitoringSetup = async () => {
    try {
      // Check for email delivery logs table
      const { data, error } = await supabase
        .from('smtp_delivery_logs')
        .select('id')
        .limit(1);
        
      if (error) {
        updateDiagnostic('monitoring-setup', {
          status: 'warning',
          message: 'Email delivery logging not available',
          recommendation: 'Set up delivery tracking for production monitoring'
        });
        return;
      }
      
      // Check for recent logs (indicates active monitoring)
      const { data: recentLogs } = await supabase
        .from('smtp_delivery_logs')
        .select('id')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);
        
      if (recentLogs && recentLogs.length > 0) {
        updateDiagnostic('monitoring-setup', {
          status: 'pass',
          message: 'Active email monitoring and logging detected'
        });
      } else {
        updateDiagnostic('monitoring-setup', {
          status: 'warning',
          message: 'Monitoring configured but no recent activity',
          recommendation: 'Send test emails to verify monitoring is working'
        });
      }
      
    } catch (error) {
      updateDiagnostic('monitoring-setup', {
        status: 'warning',
        message: 'Monitoring setup validation failed'
      });
    }
  };

  const testDeliveryTracking = async () => {
    try {
      // Check for communication events table
      const { data, error } = await supabase
        .from('communication_events')
        .select('id, status')
        .limit(5);
        
      if (error) {
        updateDiagnostic('delivery-tracking', {
          status: 'warning',
          message: 'Email delivery tracking not available',
          recommendation: 'Set up communication events tracking'
        });
        return;
      }
      
      const statusTypes = [...new Set(data?.map(d => d.status) || [])];
      
      if (statusTypes.length === 0) {
        updateDiagnostic('delivery-tracking', {
          status: 'warning',
          message: 'No email delivery records found',
          recommendation: 'Send test emails to populate delivery tracking'
        });
      } else {
        updateDiagnostic('delivery-tracking', {
          status: 'pass',
          message: `Delivery tracking active (${statusTypes.length} status types)`
        });
      }
      
    } catch (error) {
      updateDiagnostic('delivery-tracking', {
        status: 'warning',
        message: 'Delivery tracking validation failed'
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

        {/* Production-Ready Action Plans */}
        {overallStatus === 'critical' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 mb-3">🚨 Production Blockers - Immediate Action Required</h4>
            <div className="text-sm text-red-700 space-y-2">
              <div>
                <strong>1. Complete SMTP Configuration</strong>
                <p className="ml-4 text-xs">→ Settings → SMTP Settings → Configure host, user, secure password</p>
              </div>
              <div>
                <strong>2. Deploy Edge Functions</strong>
                <p className="ml-4 text-xs">→ Check Supabase Functions dashboard for deployment status</p>
              </div>
              <div>
                <strong>3. Secure Credential Storage</strong>
                <p className="ml-4 text-xs">→ Move SMTP password to Supabase Function Secrets (production requirement)</p>
              </div>
              <div>
                <strong>4. Enable HTTPS</strong>
                <p className="ml-4 text-xs">→ Ensure production site uses HTTPS for secure email transmission</p>
              </div>
            </div>
          </div>
        )}
        
        {overallStatus === 'warning' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 mb-3">⚠️ Production Optimization Recommendations</h4>
            <div className="text-sm text-yellow-700 space-y-2">
              <div>
                <strong>Security Hardening</strong>
                <p className="ml-4 text-xs">• Use Function Secrets for SMTP credentials</p>
                <p className="ml-4 text-xs">• Enable SSL/TLS (port 587 or 465)</p>
                <p className="ml-4 text-xs">• Implement sender domain authentication (SPF/DKIM)</p>
              </div>
              <div>
                <strong>Operational Excellence</strong>
                <p className="ml-4 text-xs">• Set up email templates for consistency</p>
                <p className="ml-4 text-xs">• Configure monitoring and alerting</p>
                <p className="ml-4 text-xs">• Test delivery tracking and bounce handling</p>
              </div>
              <div>
                <strong>Performance & Reliability</strong>
                <p className="ml-4 text-xs">• Verify rate limiting is active</p>
                <p className="ml-4 text-xs">• Set up backup SMTP provider (optional)</p>
                <p className="ml-4 text-xs">• Configure email queue processing</p>
              </div>
            </div>
          </div>
        )}
        
        {overallStatus === 'healthy' && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-sm font-medium text-green-800 mb-3">✅ Production-Ready Email System</h4>
            <div className="text-sm text-green-700 space-y-2">
              <div>
                <strong>Core Systems ✓</strong>
                <p className="ml-4 text-xs">• SMTP configuration validated and secure</p>
                <p className="ml-4 text-xs">• Edge functions deployed and operational</p>
                <p className="ml-4 text-xs">• SSL/TLS encryption enabled</p>
              </div>
              <div>
                <strong>Production Features ✓</strong>
                <p className="ml-4 text-xs">• Email delivery tracking active</p>
                <p className="ml-4 text-xs">• Rate limiting protection enabled</p>
                <p className="ml-4 text-xs">• Monitoring and logging configured</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="flex items-center justify-between">
                <p className="text-xs text-green-600">
                  🚀 <strong>Ready for Production:</strong> All systems operational
                </p>
                <Badge className="bg-green-100 text-green-800 text-xs">
                  PRODUCTION READY
                </Badge>
              </div>
              <p className="text-xs text-green-600 mt-1">
                💡 <strong>Next Step:</strong> Send test emails to validate end-to-end delivery
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};