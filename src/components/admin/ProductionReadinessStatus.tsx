import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertTriangle, Rocket, Settings, Database, Mail, Shield, Users, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReadinessCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'checking';
  category: 'Security' | 'Email' | 'Database' | 'Authentication' | 'Production';
  critical: boolean;
  details?: string;
}

interface SecurityValidationData {
  auth_health: any;
  security_compliance: any;
  production_ready: any;
  success: boolean;
  error?: string;
}

export const ProductionReadinessStatus = () => {
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallScore, setOverallScore] = useState(0);
  const [readyForProduction, setReadyForProduction] = useState(false);
  const [validationData, setValidationData] = useState<SecurityValidationData | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { toast } = useToast();

  const runProductionReadinessCheck = async () => {
    setIsRunning(true);
    setChecks([]);
    
    try {
      // Initialize checking status
      const initialChecks: ReadinessCheck[] = [
        {
          id: 'auth-health',
          name: 'Authentication System Health',
          description: 'User registration, verification, and authentication success rates',
          status: 'checking',
          category: 'Authentication',
          critical: true
        },
        {
          id: 'security-compliance',
          name: 'Security & Database Protection',
          description: 'RLS policies, database security, and access controls',
          status: 'checking',
          category: 'Security',
          critical: true
        },
        {
          id: 'email-system',
          name: 'Email System Status',
          description: 'SMTP health, delivery rates, and email configuration',
          status: 'checking',
          category: 'Email',
          critical: true
        },
        {
          id: 'production-validation',
          name: 'Production Readiness',
          description: 'Comprehensive system validation for production deployment',
          status: 'checking',
          category: 'Production',
          critical: true
        }
      ];
      
      setChecks(initialChecks);

      // Run comprehensive security and auth validation with timeout
      const validationPromise = supabase.functions.invoke('auth-security-validator');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Validation timeout')), 15000)
      );
      
      let validationResult;
      try {
        const { data, error: validationError } = await Promise.race([validationPromise, timeoutPromise]) as any;
        
        if (validationError) {
          console.warn('Validation failed, using fallback:', validationError.message);
          validationResult = { 
            success: false, 
            error: validationError.message,
            auth_health: { healthy: false, score: 0, status: 'unavailable' },
            security_compliance: { compliant: false, score: 0 },
            production_ready: { ready_for_production: false, overall_score: 0, status: 'error' }
          };
        } else {
          validationResult = data;
        }
      } catch (error) {
        console.warn('Validation timeout, using fallback data');
        validationResult = { 
          success: false, 
          error: 'Service timeout',
          auth_health: { healthy: false, score: 0, status: 'timeout' },
          security_compliance: { compliant: false, score: 0 },
          production_ready: { ready_for_production: false, overall_score: 0, status: 'timeout' }
        };
      }

      setValidationData(validationResult);

      // Run email system check with timeout
      let emailResult;
      try {
        const emailPromise = supabase.functions.invoke('email-delivery-monitor');
        const emailTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email check timeout')), 10000)
        );
        
        const { data, error: emailError } = await Promise.race([emailPromise, emailTimeoutPromise]) as any;
        emailResult = emailError ? null : data;
      } catch (error) {
        console.warn('Email check timeout, using fallback');
        emailResult = null;
      }
      
      const updatedChecks: ReadinessCheck[] = [];

      // Process authentication health
      if (validationResult.auth_health) {
        const authHealth = validationResult.auth_health;
        updatedChecks.push({
          id: 'auth-health',
          name: 'Authentication System Health',
          description: 'User registration, verification, and authentication success rates',
          status: authHealth.healthy ? 'pass' : 'fail',
          category: 'Authentication',
          critical: true,
          details: `Score: ${authHealth.score}/100 - Status: ${authHealth.status}${authHealth.metrics ? ` | Users: ${authHealth.metrics.total_users}, Verified: ${authHealth.metrics.verification_rate}%` : ''}`
        });
      }

      // Process security compliance
      if (validationResult.security_compliance) {
        const security = validationResult.security_compliance;
        updatedChecks.push({
          id: 'security-compliance',
          name: 'Security & Database Protection',
          description: 'RLS policies, database security, and access controls',
          status: security.compliant ? 'pass' : 'fail',
          category: 'Security',
          critical: true,
          details: `Score: ${security.score}/100 | RLS Tables: ${security.metrics?.tables_with_rls || 0}/${(security.metrics?.tables_with_rls || 0) + (security.metrics?.tables_without_rls || 0)}`
        });
      }

      // Process email system
      if (emailResult) {
        const emailHealthy = emailResult.smtp_health?.healthy && emailResult.delivery_health?.healthy;
        updatedChecks.push({
          id: 'email-system',
          name: 'Email System Status',
          description: 'SMTP health, delivery rates, and email configuration',
          status: emailHealthy ? 'pass' : (emailResult.smtp_health?.healthy ? 'warning' : 'fail'),
          category: 'Email',
          critical: true,
          details: `SMTP: ${emailResult.smtp_health?.status || 'unknown'} | Delivery: ${emailResult.delivery_health?.status || 'unknown'}`
        });
      } else {
        updatedChecks.push({
          id: 'email-system',
          name: 'Email System Status',
          description: 'SMTP health, delivery rates, and email configuration',
          status: 'warning',
          category: 'Email',
          critical: true,
          details: 'Email health check unavailable'
        });
      }

      // Process production readiness
      if (validationResult.production_ready) {
        const production = validationResult.production_ready;
        updatedChecks.push({
          id: 'production-validation',
          name: 'Production Readiness',
          description: 'Comprehensive system validation for production deployment',
          status: production.ready_for_production ? 'pass' : 'fail',
          category: 'Production',
          critical: true,
          details: `Overall Score: ${production.overall_score}/100 | Status: ${production.status} | Issues: ${production.issues?.length || 0}`
        });
      }

      setChecks(updatedChecks);

      // Calculate overall metrics
      const passedChecks = updatedChecks.filter(c => c.status === 'pass').length;
      const totalChecks = updatedChecks.length;
      const calculatedScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
      
      setOverallScore(calculatedScore);
      setReadyForProduction(calculatedScore >= 80 && updatedChecks.every(c => c.status !== 'fail'));
      setLastChecked(new Date());

      toast({
        title: "Production Readiness Check Completed",
        description: `System scored ${calculatedScore}/100. ${readyForProduction ? 'Ready for production!' : 'Needs attention before production.'}`,
        variant: calculatedScore >= 80 ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Production readiness check failed:', error);
      toast({
        title: "Check Failed",
        description: error instanceof Error ? error.message : 'Failed to run production readiness check',
        variant: "destructive"
      });

      // Set error state
      setChecks([
        {
          id: 'system-error',
          name: 'System Check Error',
          description: 'Unable to complete production readiness verification',
          status: 'fail',
          category: 'Production',
          critical: true,
          details: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      ]);
      setOverallScore(0);
      setReadyForProduction(false);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runProductionReadinessCheck();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-success/10 text-success border-success/20">PASS</Badge>;
      case 'fail':
        return <Badge variant="destructive">FAIL</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">WARNING</Badge>;
      case 'checking':
        return <Badge variant="outline">CHECKING</Badge>;
      default:
        return <Badge variant="outline">UNKNOWN</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Authentication':
        return <Users className="w-5 h-5 text-primary" />;
      case 'Security':
        return <Shield className="w-5 h-5 text-destructive" />;
      case 'Email':
        return <Mail className="w-5 h-5 text-success" />;
      case 'Database':
        return <Database className="w-5 h-5 text-accent" />;
      case 'Production':
        return <Rocket className="w-5 h-5 text-warning" />;
      default:
        return <Settings className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const criticalIssues = checks.filter(c => c.critical && c.status === 'fail');
  const warnings = checks.filter(c => c.status === 'warning');
  const recommendations = validationData?.production_ready?.recommendations || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="w-6 h-6" />
                Production Readiness Status
              </CardTitle>
              <CardDescription>
                Comprehensive system validation for production deployment
                {lastChecked && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    Last checked: {lastChecked.toLocaleString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <Button 
              onClick={runProductionReadinessCheck} 
              disabled={isRunning}
              variant="outline"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-check
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {readyForProduction ? (
                <CheckCircle className="w-8 h-8 text-success" />
              ) : (
                <XCircle className="w-8 h-8 text-destructive" />
              )}
              <div>
                <h3 className="text-lg font-semibold">
                  {readyForProduction ? 'Ready for Production' : 'Not Ready for Production'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Overall Score: {overallScore}/100
                </p>
              </div>
            </div>
            <Progress value={overallScore} className="w-32" />
          </div>

          {/* Critical Issues Alert */}
          {criticalIssues.length > 0 && (
            <div className="p-4 border-l-4 border-l-destructive bg-destructive/5 rounded-r-lg">
              <h4 className="font-semibold text-destructive flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Critical Issues ({criticalIssues.length})
              </h4>
              <ul className="mt-2 space-y-1">
                {criticalIssues.map(issue => (
                  <li key={issue.id} className="text-sm text-destructive/80">
                    • {issue.name}: {issue.details || 'Failed validation'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="p-4 border-l-4 border-l-warning bg-warning/5 rounded-r-lg">
              <h4 className="font-semibold text-warning flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Warnings ({warnings.length})
              </h4>
              <ul className="mt-2 space-y-1">
                {warnings.map(warning => (
                  <li key={warning.id} className="text-sm text-warning/80">
                    • {warning.name}: {warning.details || 'Needs attention'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="p-4 border-l-4 border-l-primary bg-primary/5 rounded-r-lg">
              <h4 className="font-semibold text-primary flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Recommendations ({recommendations.length})
              </h4>
              <ul className="mt-2 space-y-1">
                {recommendations.map((rec: string, index: number) => (
                  <li key={index} className="text-sm text-primary/80">
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed System Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed System Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {checks.map((check) => (
              <Card key={check.id} className={check.critical ? 'border-l-4 border-l-primary' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(check.category)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{check.name}</span>
                          {check.critical && (
                            <Badge variant="outline" className="text-xs border-primary/20 text-primary">CRITICAL</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{check.description}</p>
                        {check.details && (
                          <p className="text-xs text-muted-foreground mt-1">{check.details}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(check.status)}
                      {getStatusBadge(check.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Metrics */}
      {validationData && (
        <Card>
          <CardHeader>
            <CardTitle>Security & Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Authentication Metrics */}
              {validationData.auth_health?.metrics && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4" />
                    Authentication
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Users:</span>
                      <span className="font-medium">{validationData.auth_health.metrics.total_users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Verification Rate:</span>
                      <span className="font-medium">{validationData.auth_health.metrics.verification_rate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Auth Success:</span>
                      <span className="font-medium">{validationData.auth_health.metrics.successful_auth}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Metrics */}
              {validationData.security_compliance?.metrics && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4" />
                    Security
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>RLS Protected:</span>
                      <span className="font-medium">{validationData.security_compliance.metrics.tables_with_rls}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security Events:</span>
                      <span className="font-medium">{validationData.security_compliance.metrics.recent_security_events}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Compliance Score:</span>
                      <span className="font-medium">{validationData.security_compliance.score}/100</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Production Metrics */}
              {validationData.production_ready?.component_scores && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Rocket className="w-4 h-4" />
                    Production
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Auth Score:</span>
                      <span className="font-medium">{validationData.production_ready.component_scores.authentication}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security Score:</span>
                      <span className="font-medium">{validationData.production_ready.component_scores.security}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Config Score:</span>
                      <span className="font-medium">{validationData.production_ready.component_scores.configuration}/100</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};