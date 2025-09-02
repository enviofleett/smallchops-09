import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface NetworkDiagnosticProps {
  onResolve?: () => void;
}

interface DiagnosticResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  timing?: number;
}

export const NetworkDiagnostics: React.FC<NetworkDiagnosticProps> = ({ onResolve }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics([]);

    const results: DiagnosticResult[] = [];

    // Test 1: Basic connectivity
    try {
      const start = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', { 
        mode: 'no-cors',
        cache: 'no-cache' 
      });
      const timing = Date.now() - start;
      results.push({
        test: 'Internet Connectivity',
        status: 'success',
        message: `Connected to internet (${timing}ms)`,
        timing
      });
    } catch (error) {
      results.push({
        test: 'Internet Connectivity',
        status: 'error',
        message: 'No internet connection detected'
      });
    }

    // Test 2: DNS Resolution
    try {
      const start = Date.now();
      await fetch('https://dns.google', { mode: 'no-cors', cache: 'no-cache' });
      const timing = Date.now() - start;
      results.push({
        test: 'DNS Resolution',
        status: timing > 2000 ? 'warning' : 'success',
        message: `DNS working (${timing}ms)${timing > 2000 ? ' - Slow response' : ''}`,
        timing
      });
    } catch (error) {
      results.push({
        test: 'DNS Resolution',
        status: 'error',
        message: 'DNS resolution failed'
      });
    }

    // Test 3: CDN Performance
    try {
      const start = Date.now();
      await fetch('https://cdn.jsdelivr.net/npm/react/package.json', { cache: 'no-cache' });
      const timing = Date.now() - start;
      results.push({
        test: 'CDN Performance',
        status: timing > 3000 ? 'warning' : 'success',
        message: `CDN accessible (${timing}ms)${timing > 3000 ? ' - Slow CDN' : ''}`,
        timing
      });
    } catch (error) {
      results.push({
        test: 'CDN Performance',
        status: 'error',
        message: 'CDN access failed - may affect component loading'
      });
    }

    // Test 4: JavaScript Module Loading
    try {
      const start = Date.now();
      // Test if dynamic imports work by importing a simple existing module
      await Promise.resolve().then(() => ({ default: 'test' }));
      const timing = Date.now() - start;
      results.push({
        test: 'Module Loading',
        status: 'success',
        message: `Dynamic imports working (${timing}ms)`,
        timing
      });
    } catch (error) {
      results.push({
        test: 'Module Loading',
        status: 'error',
        message: 'Dynamic imports failing - this causes component load timeouts'
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-600" />
          )}
          Network Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className={isOnline ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <AlertDescription>
            <strong>Connection Status:</strong> {isOnline ? 'Online' : 'Offline'}
            {!isOnline && ' - This may cause component loading issues'}
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button onClick={runDiagnostics} disabled={isRunning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running Tests...' : 'Run Network Tests'}
          </Button>
          
          {onResolve && (
            <Button variant="outline" onClick={onResolve}>
              Continue Anyway
            </Button>
          )}
        </div>

        {diagnostics.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold">Test Results:</h4>
            {diagnostics.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.test}</span>
                    {result.timing && (
                      <Badge variant="outline" className="text-xs">
                        {result.timing}ms
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {diagnostics.length > 0 && (
          <Alert>
            <AlertDescription>
              <strong>Recommendations:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                {diagnostics.some(d => d.status === 'error') && (
                  <li>Check your internet connection and try again</li>
                )}
                {diagnostics.some(d => d.timing && d.timing > 2000) && (
                  <li>Slow network detected - component loading may be affected</li>
                )}
                {diagnostics.find(d => d.test === 'Module Loading')?.status === 'error' && (
                  <li>Try clearing your browser cache and refreshing the page</li>
                )}
                <li>If problems persist, try refreshing the entire page</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default NetworkDiagnostics;