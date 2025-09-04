import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface ProductionReadiness {
  overall_status: 'ready' | 'not_ready' | 'needs_attention';
  score: number;
  checks: HealthCheck[];
  recommendations: string[];
}

export const ProductionReadinessCheck: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ProductionReadiness | null>(null);

  const runProductionHealthCheck = async () => {
    setIsRunning(true);
    try {
      // Run comprehensive production health check
      const { data, error } = await supabase.functions.invoke('paystack-production-health');
      
      if (error) {
        throw new Error(error.message);
      }

      setResults(data);
      
      if (data.overall_status === 'ready') {
        toast({
          title: "Production Ready! 🚀",
          description: `System passed ${data.score}% of production readiness checks`,
        });
      } else {
        toast({
          title: "Production Check Complete",
          description: `Found issues that need attention (Score: ${data.score}%)`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Production health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
      case 'ready':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
      case 'needs_attention':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'fail':
      case 'not_ready':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
      case 'ready':
        return <Badge variant="default" className="bg-green-100 text-green-800">PASS</Badge>;
      case 'warning':
      case 'needs_attention':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">WARNING</Badge>;
      case 'fail':
      case 'not_ready':
        return <Badge variant="destructive">FAIL</Badge>;
      default:
        return <Badge variant="outline">UNKNOWN</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚀 Production Readiness Check
          {results && getStatusIcon(results.overall_status)}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Comprehensive health check for production deployment
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Button 
          onClick={runProductionHealthCheck}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Production Health Check...
            </>
          ) : (
            'Run Production Health Check'
          )}
        </Button>

        {results && (
          <div className="space-y-4">
            {/* Overall Status */}
            <Alert className={
              results.overall_status === 'ready' ? 'border-green-200 bg-green-50' :
              results.overall_status === 'needs_attention' ? 'border-yellow-200 bg-yellow-50' :
              'border-red-200 bg-red-50'
            }>
              <AlertDescription className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(results.overall_status)}
                  <span className="font-semibold">
                    Production Status: {results.overall_status.toUpperCase()}
                  </span>
                </div>
                <Badge variant="outline" className="ml-2">
                  Score: {results.score}%
                </Badge>
              </AlertDescription>
            </Alert>

            {/* Individual Checks */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Health Check Results:</h4>
              {results.checks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(check.status)}
                    <span className="font-medium">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(check.status)}
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {results.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Recommendations:</h4>
                <ul className="text-sm space-y-1">
                  {results.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Final Verdict */}
            <Alert className={results.overall_status === 'ready' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription>
                <strong>
                  {results.overall_status === 'ready' 
                    ? '✅ GO FOR PRODUCTION: Your system is ready for live deployment!' 
                    : '❌ NOT READY: Please address the issues above before going live.'}
                </strong>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
};