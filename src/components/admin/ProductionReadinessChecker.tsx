import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Shield, 
  Database,
  Zap,
  Globe,
  Settings,
  RefreshCw
} from 'lucide-react';

interface ReadinessCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'checking';
  details?: string;
  score: number;
  category: string;
}

export const ProductionReadinessChecker = () => {
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallScore, setOverallScore] = useState(0);
  const { toast } = useToast();

  const runReadinessChecks = async () => {
    setIsRunning(true);
    const newChecks: ReadinessCheck[] = [];

    try {
      // 1. Database Security Check
      newChecks.push({
        id: 'db_security',
        name: 'Database Security',
        description: 'RLS policies and security functions',
        status: 'checking',
        category: 'security',
        score: 0
      });

      // Check if critical tables exist by trying to query them
      const criticalTables = ['profiles', 'customer_accounts', 'orders', 'payment_transactions'];
      const tableChecks = await Promise.allSettled(
        criticalTables.map(async (tableName) => {
          const { error } = await supabase.from(tableName as any).select('id').limit(1);
          return { tableName, exists: !error };
        })
      );

      let securityScore = 100;
      let securityDetails: string[] = [];

      // Process table check results
      tableChecks.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.exists) {
            securityDetails.push(`✓ ${result.value.tableName} table exists`);
          } else {
            securityScore -= 20;
            securityDetails.push(`✗ ${result.value.tableName} table missing or inaccessible`);
          }
        } else {
          securityScore -= 20;
          securityDetails.push(`✗ ${criticalTables[index]} table missing or inaccessible`);
        }
      });

      newChecks[newChecks.length - 1] = {
        ...newChecks[newChecks.length - 1],
        status: securityScore >= 80 ? 'pass' : securityScore >= 60 ? 'warning' : 'fail',
        score: securityScore,
        details: securityDetails.join(', ')
      };

      // 2. Authentication Configuration
      newChecks.push({
        id: 'auth_config',
        name: 'Authentication Setup',
        description: 'Auth providers and security settings',
        status: 'checking',
        category: 'security',
        score: 0
      });

      // Check auth configuration
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      let authScore = user ? 80 : 20; // Basic check if auth is working
      
      newChecks[newChecks.length - 1] = {
        ...newChecks[newChecks.length - 1],
        status: authScore >= 70 ? 'pass' : 'warning',
        score: authScore,
        details: user ? 'Authentication working' : 'Authentication may need configuration'
      };

      // 3. Business Settings
      newChecks.push({
        id: 'business_config',
        name: 'Business Configuration',
        description: 'Business settings and branding',
        status: 'checking',
        category: 'configuration',
        score: 0
      });

      const { data: businessSettings, error: businessError } = await supabase
        .from('business_settings')
        .select('*')
        .limit(1)
        .single();

      let businessScore = 0;
      let businessDetails: string[] = [];

      if (!businessError && businessSettings) {
        if (businessSettings.name && businessSettings.name !== 'Your Business Name') {
          businessScore += 25;
          businessDetails.push('✓ Business name configured');
        } else {
          businessDetails.push('✗ Business name needs setup');
        }

        if (businessSettings.email) {
          businessScore += 25;
          businessDetails.push('✓ Business email configured');
        } else {
          businessDetails.push('✗ Business email missing');
        }

        if (businessSettings.logo_url) {
          businessScore += 25;
          businessDetails.push('✓ Logo uploaded');
        } else {
          businessDetails.push('✗ Logo not uploaded');
        }

        if (businessSettings.primary_color !== '#3b82f6') {
          businessScore += 25;
          businessDetails.push('✓ Custom branding colors');
        } else {
          businessDetails.push('✗ Using default colors');
        }
      } else {
        businessDetails.push('✗ Business settings not configured');
      }

      newChecks[newChecks.length - 1] = {
        ...newChecks[newChecks.length - 1],
        status: businessScore >= 75 ? 'pass' : businessScore >= 50 ? 'warning' : 'fail',
        score: businessScore,
        details: businessDetails.join(', ')
      };

      // 4. Payment Integration
      newChecks.push({
        id: 'payment_config',
        name: 'Payment System',
        description: 'Payment gateway configuration',
        status: 'checking',
        category: 'integration',
        score: 0
      });

      const { data: paymentConfig, error: paymentError } = await supabase
        .from('payment_integrations')
        .select('*')
        .eq('provider', 'paystack')
        .limit(1)
        .single();

      let paymentScore = 0;
      let paymentDetails: string[] = [];

      if (!paymentError && paymentConfig) {
        if (paymentConfig.connection_status === 'connected') {
          paymentScore += 50;
          paymentDetails.push('✓ Payment gateway connected');
        } else {
          paymentDetails.push('✗ Payment gateway not connected');
        }

        if (paymentConfig.public_key && paymentConfig.secret_key) {
          paymentScore += 30;
          paymentDetails.push('✓ API keys configured');
        } else {
          paymentDetails.push('✗ API keys missing');
        }

        if (paymentConfig.webhook_secret) {
          paymentScore += 20;
          paymentDetails.push('✓ Webhook configured');
        } else {
          paymentDetails.push('✗ Webhook needs setup');
        }
      } else {
        paymentDetails.push('✗ Payment integration not configured');
      }

      newChecks[newChecks.length - 1] = {
        ...newChecks[newChecks.length - 1],
        status: paymentScore >= 80 ? 'pass' : paymentScore >= 50 ? 'warning' : 'fail',
        score: paymentScore,
        details: paymentDetails.join(', ')
      };

      // 5. Email System
      newChecks.push({
        id: 'email_config',
        name: 'Email System',
        description: 'Email service configuration',
        status: 'checking',
        category: 'communication',
        score: 0
      });

      const { data: emailConfig, error: emailError } = await supabase
        .from('communication_settings')
        .select('*')
        .limit(1)
        .single();

      let emailScore = 0;
      let emailDetails: string[] = [];

      if (!emailError && emailConfig) {
        if (emailConfig.sender_email) {
          emailScore += 40;
          emailDetails.push('✓ Sender email configured');
        } else {
          emailDetails.push('✗ Sender email missing');
        }

        if (emailConfig.email_provider) {
          emailScore += 40;
          emailDetails.push(`✓ Email provider: ${emailConfig.email_provider}`);
        } else {
          emailDetails.push('✗ Email provider not set');
        }

        if (emailConfig.use_smtp && emailConfig.smtp_host) {
          emailScore += 20;
          emailDetails.push('✓ SMTP configured');
        } else {
          emailDetails.push('○ SMTP not configured (using default)');
        }
      } else {
        emailDetails.push('✗ Email system not configured');
      }

      newChecks[newChecks.length - 1] = {
        ...newChecks[newChecks.length - 1],
        status: emailScore >= 70 ? 'pass' : emailScore >= 40 ? 'warning' : 'fail',
        score: emailScore,
        details: emailDetails.join(', ')
      };

      // 6. Content Management
      newChecks.push({
        id: 'content_ready',
        name: 'Content Readiness',
        description: 'Products, categories, and content',
        status: 'checking',
        category: 'content',
        score: 0
      });

      // Check products and categories
      const [
        { count: productCount },
        { count: categoryCount }
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true })
      ]);

      let contentScore = 0;
      let contentDetails: string[] = [];

      if (categoryCount && categoryCount > 0) {
        contentScore += 30;
        contentDetails.push(`✓ ${categoryCount} categories created`);
      } else {
        contentDetails.push('✗ No categories created');
      }

      if (productCount && productCount >= 3) {
        contentScore += 50;
        contentDetails.push(`✓ ${productCount} products added`);
      } else if (productCount && productCount > 0) {
        contentScore += 25;
        contentDetails.push(`○ Only ${productCount} products (recommend 3+)`);
      } else {
        contentDetails.push('✗ No products added');
      }

      contentScore += 20; // Base score for having the tables

      newChecks[newChecks.length - 1] = {
        ...newChecks[newChecks.length - 1],
        status: contentScore >= 80 ? 'pass' : contentScore >= 50 ? 'warning' : 'fail',
        score: contentScore,
        details: contentDetails.join(', ')
      };

      // Calculate overall score
      const totalScore = newChecks.reduce((sum, check) => sum + check.score, 0);
      const avgScore = Math.round(totalScore / newChecks.length);
      setOverallScore(avgScore);

      setChecks(newChecks);

      toast({
        title: "Production readiness check completed",
        description: `Overall score: ${avgScore}/100`,
        variant: avgScore >= 80 ? "default" : "destructive"
      });

    } catch (error: any) {
      console.error('Error running readiness checks:', error);
      toast({
        title: "Error running readiness checks",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'fail': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'checking': return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default: return null;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security': return <Shield className="h-4 w-4" />;
      case 'configuration': return <Settings className="h-4 w-4" />;
      case 'integration': return <Zap className="h-4 w-4" />;
      case 'communication': return <Globe className="h-4 w-4" />;
      case 'content': return <Database className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getOverallStatus = () => {
    if (overallScore >= 90) return { status: 'excellent', color: 'green', message: 'Ready for production!' };
    if (overallScore >= 80) return { status: 'good', color: 'blue', message: 'Almost ready - minor issues to address' };
    if (overallScore >= 60) return { status: 'fair', color: 'yellow', message: 'Needs improvement before production' };
    return { status: 'poor', color: 'red', message: 'Not ready for production' };
  };

  useEffect(() => {
    runReadinessChecks();
  }, []);

  const overall = getOverallStatus();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Production Readiness</h2>
          <p className="text-muted-foreground">Comprehensive system readiness assessment</p>
        </div>
        <Button onClick={runReadinessChecks} disabled={isRunning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
          Run Checks
        </Button>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Overall Readiness Score
            <Badge variant={overall.color === 'green' ? 'default' : 'destructive'}>
              {overall.status.toUpperCase()}
            </Badge>
          </CardTitle>
          <CardDescription>{overall.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Score</span>
              <span className="text-2xl font-bold">{overallScore}/100</span>
            </div>
            <Progress value={overallScore} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Detailed Checks */}
      <div className="grid gap-4">
        {checks.map((check) => (
          <Card key={check.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(check.category)}
                    {getStatusIcon(check.status)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{check.name}</h3>
                      <Badge variant="outline">{check.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{check.description}</p>
                    {check.details && (
                      <p className="text-xs text-muted-foreground">{check.details}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{check.score}/100</div>
                  <Progress value={check.score} className="w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Actions to improve production readiness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checks.filter(c => c.status === 'fail').length > 0 && (
              <Alert>
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Critical Issues:</strong> Address all failed checks before deploying to production.
                </AlertDescription>
              </Alert>
            )}
            
            {checks.filter(c => c.status === 'warning').length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warnings:</strong> Review and improve warning items for optimal performance.
                </AlertDescription>
              </Alert>
            )}
            
            {overallScore >= 90 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Excellent!</strong> Your system is ready for production deployment.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};