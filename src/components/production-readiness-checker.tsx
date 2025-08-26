/**
 * Production Readiness Checker Component
 * Provides a comprehensive dashboard for checking production readiness
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Shield, 
  Database,
  CreditCard,
  Globe,
  Settings,
  Activity
} from 'lucide-react';
import { ProductionValidator, ProductionCheck, ProductionReadiness } from '@/lib/production-checks';
import { ErrorBoundary } from './error-boundary';

interface ProductionReadinessCheckerProps {
  onReadinessChange?: (isReady: boolean, score: number) => void;
}

export const ProductionReadinessChecker: React.FC<ProductionReadinessCheckerProps> = ({
  onReadinessChange
}) => {
  const [readiness, setReadiness] = useState<ProductionReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runProductionCheck = async () => {
    setIsLoading(true);
    try {
      const result = await ProductionValidator.performFullCheck();
      setReadiness(result);
      setLastChecked(new Date());
      
      if (onReadinessChange) {
        onReadinessChange(result.isReady, result.score);
      }
    } catch (error) {
      console.error('Production check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Run initial check
    runProductionCheck();
  }, []);

  const getStatusIcon = (status: ProductionCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ProductionCheck['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-green-500';
      case 'fail':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const categorizeChecks = (checks: ProductionCheck[]) => {
    const categories = {
      payment: checks.filter(c => 
        c.name.toLowerCase().includes('paystack') || 
        c.name.toLowerCase().includes('payment') ||
        c.name.toLowerCase().includes('key')
      ),
      database: checks.filter(c => 
        c.name.toLowerCase().includes('database') || 
        c.name.toLowerCase().includes('connection') ||
        c.name.toLowerCase().includes('supabase')
      ),
      security: checks.filter(c => 
        c.name.toLowerCase().includes('security') || 
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('ssl')
      ),
      system: checks.filter(c => 
        !['payment', 'database', 'security'].some(cat => 
          categorizeChecks(checks)[cat as keyof typeof categories]?.includes(c)
        )
      )
    };
    return categories;
  };

  const renderCheckItem = (check: ProductionCheck) => (
    <div key={check.name} className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center space-x-3">
        {getStatusIcon(check.status)}
        <div>
          <p className="font-medium text-sm">{check.name}</p>
          <p className="text-xs text-gray-600">{check.message}</p>
        </div>
      </div>
      <Badge 
        variant={check.status === 'pass' ? 'default' : check.status === 'fail' ? 'destructive' : 'secondary'}
        className="text-xs"
      >
        {check.status.toUpperCase()}
      </Badge>
    </div>
  );

  const renderCategoryTab = (categoryName: string, checks: ProductionCheck[], icon: React.ReactNode) => {
    const passCount = checks.filter(c => c.status === 'pass').length;
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    return (
      <TabsContent value={categoryName} className="space-y-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{passCount}</div>
              <div className="text-xs text-gray-600">Passing</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
              <div className="text-xs text-gray-600">Warnings</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <div className="text-xs text-gray-600">Failing</div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-2">
          {checks.length > 0 ? (
            checks.map(renderCheckItem)
          ) : (
            <p className="text-gray-500 text-center py-8">No checks in this category</p>
          )}
        </div>
      </TabsContent>
    );
  };

  if (!readiness) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <RefreshCw className={`h-8 w-8 mx-auto ${isLoading ? 'animate-spin' : ''}`} />
            <p className="text-gray-600">
              {isLoading ? 'Running production readiness checks...' : 'Loading production status...'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const categories = categorizeChecks(readiness.checks);

  return (
    <ErrorBoundary name="ProductionReadinessChecker" level="component">
      <div className="space-y-6">
        {/* Overall Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Production Readiness</span>
                </CardTitle>
                <CardDescription>
                  Overall system health and production readiness score
                </CardDescription>
              </div>
              <Button 
                onClick={runProductionCheck} 
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Score and Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Readiness Score</span>
                <span className="text-sm text-gray-600">{readiness.score}%</span>
              </div>
              <Progress value={readiness.score} className="h-2" />
            </div>

            {/* Overall Status */}
            <div className="flex items-center space-x-2">
              {readiness.isReady ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {readiness.isReady ? 'Ready for Production' : 'Not Ready for Production'}
              </span>
            </div>

            {/* Last Checked */}
            {lastChecked && (
              <p className="text-xs text-gray-600">
                Last checked: {lastChecked.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Critical Issues */}
        {readiness.criticalIssues.length > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Critical Issues Found:</p>
                <ul className="list-disc list-inside space-y-1">
                  {readiness.criticalIssues.map((issue, index) => (
                    <li key={index} className="text-sm">{issue}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Warnings */}
        {readiness.warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Warnings:</p>
                <ul className="list-disc list-inside space-y-1">
                  {readiness.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Detailed Checks by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Checks</CardTitle>
            <CardDescription>
              Breakdown of all production readiness checks by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="payment" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="payment" className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4" />
                  <span>Payment</span>
                </TabsTrigger>
                <TabsTrigger value="database" className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Database</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>Security</span>
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>System</span>
                </TabsTrigger>
              </TabsList>

              {renderCategoryTab('payment', categories.payment, <CreditCard className="h-4 w-4" />)}
              {renderCategoryTab('database', categories.database, <Database className="h-4 w-4" />)}
              {renderCategoryTab('security', categories.security, <Shield className="h-4 w-4" />)}
              {renderCategoryTab('system', categories.system, <Settings className="h-4 w-4" />)}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
};