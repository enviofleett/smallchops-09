import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductionHealthDashboard } from '@/components/production/ProductionHealthDashboard';
import { WebSocketStatusMonitor } from '@/components/production/WebSocketStatusMonitor';
import { useProductionReady } from '@/hooks/useProductionReady';
import { ProductionEmailHealthChecker } from '@/utils/production-email-health';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const ProductionOverview = () => {
  const { status, isLoading, refresh } = useProductionReady();
  const { toast } = useToast();
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  const testProductionEmail = async () => {
    setIsTestingEmail(true);
    try {
      const result = await ProductionEmailHealthChecker.testSMTPConnection();
      
      if (result.success) {
        toast({
          title: "✅ SMTP Connection Healthy",
          description: result.message,
          variant: "default"
        });
      } else {
        toast({
          title: "❌ SMTP Connection Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "❌ Email Test Failed",
        description: error.message || "Failed to test email system",
        variant: "destructive"
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const getReadinessIcon = () => {
    if (isLoading) return <RefreshCw className="w-5 h-5 animate-spin" />;
    if (status?.isReady) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status?.score && status.score > 70) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getReadinessBadge = () => {
    if (isLoading) return <Badge variant="secondary">Checking...</Badge>;
    if (status?.isReady) return <Badge variant="default">Production Ready</Badge>;
    if (status?.score && status.score > 70) return <Badge variant="secondary">Needs Attention</Badge>;
    return <Badge variant="destructive">Not Ready</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Production Overview</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
          <Button 
            variant="outline" 
            onClick={testProductionEmail} 
            disabled={isTestingEmail}
          >
            <Mail className={`w-4 h-4 mr-2 ${isTestingEmail ? 'animate-spin' : ''}`} />
            Test Email System
          </Button>
        </div>
      </div>

      {/* Production Readiness Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getReadinessIcon()}
            Production Readiness
            {getReadinessBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Readiness Score</span>
                <span className="text-2xl font-bold">{status.score}/100</span>
              </div>
              
              {status.issues.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">Critical Issues</h4>
                  <ul className="text-sm text-red-600 space-y-1">
                    {status.issues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {status.warnings.length > 0 && (
                <div>
                  <h4 className="font-medium text-yellow-600 mb-2">Warnings</h4>
                  <ul className="text-sm text-yellow-600 space-y-1">
                    {status.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Monitoring */}
      <ProductionHealthDashboard />

      {/* WebSocket Status */}
      <WebSocketStatusMonitor />
    </div>
  );
};

export default ProductionOverview;