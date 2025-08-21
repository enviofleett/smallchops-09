import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertTriangle, XCircle, Key, TestTube } from 'lucide-react';
import { debugPaystackEnvironment } from '@/utils/testPaystackEnv';

const PaystackEnvChecker = () => {
  const [result, setResult] = useState(null);
  const [isTestingEnv, setIsTestingEnv] = useState(false);
  const { toast } = useToast();

  const testEnvironment = async () => {
    setIsTestingEnv(true);
    try {
      console.log('🧪 Testing Paystack environment variable access...');
      
      const envResult = await debugPaystackEnvironment();
      setResult(envResult);
      
      if (envResult.status === 'working') {
        toast({
          title: "Environment Working",
          description: "PAYSTACK_SECRET_KEY_TEST is accessible and working.",
        });
      } else {
        toast({
          title: "Environment Issue Found",
          description: envResult.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Environment test failed:', error);
      toast({
        title: "Test Failed",
        description: `Error testing environment: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsTestingEnv(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'working':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'environment_accessible':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'environment_missing':
      case 'api_issue':
      case 'function_error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'working':
        return 'default';
      case 'environment_accessible':
        return 'secondary';
      case 'environment_missing':
      case 'api_issue':
      case 'function_error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Paystack Environment Variable Checker
        </CardTitle>
        <CardDescription>
          Test if PAYSTACK_SECRET_KEY_TEST is properly configured and accessible
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">Environment Variable Check</div>
            <p className="text-sm">
              You mentioned you have <code className="bg-muted px-1 rounded">PAYSTACK_SECRET_KEY_TEST</code> set in Supabase secrets.
              This should work since the function checks for this exact variable name.
            </p>
          </AlertDescription>
        </Alert>

        <Button 
          onClick={testEnvironment} 
          disabled={isTestingEnv}
          className="w-full"
        >
          {isTestingEnv ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Environment Access...
            </>
          ) : (
            <>
              <TestTube className="mr-2 h-4 w-4" />
              Test PAYSTACK_SECRET_KEY_TEST Access
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-4">
            {/* Status Summary */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(result.status)}
                <div>
                  <h3 className="font-semibold">{result.message}</h3>
                  <p className="text-sm text-muted-foreground">
                    Status: {result.status.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
              </div>
              <Badge variant={getStatusColor(result.status)}>
                {result.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>

            {/* Details */}
            {result.details && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Details:</div>
                  <div className="text-sm font-mono bg-muted p-2 rounded">
                    {typeof result.details === 'string' 
                      ? result.details 
                      : JSON.stringify(result.details, null, 2)}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Recommendations:</h4>
                <div className="space-y-2">
                  {result.recommendations.map((rec, index) => (
                    <Alert key={index} variant={result.status === 'working' ? 'default' : 'destructive'}>
                      <AlertDescription className="text-sm">{rec}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Environment Variable Format Info */}
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Expected Environment Variable:</div>
                <div className="text-sm space-y-1">
                  <p><strong>Name:</strong> <code className="bg-muted px-1 rounded">PAYSTACK_SECRET_KEY_TEST</code></p>
                  <p><strong>Value:</strong> Your Paystack test secret key (starts with <code className="bg-muted px-1 rounded">sk_test_</code>)</p>
                  <p><strong>Location:</strong> Supabase Dashboard → Project Settings → Edge Functions → Environment Variables</p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Function Lookup Order */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Function Environment Variable Lookup Order:</div>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  <li><code className="bg-muted px-1 rounded">PAYSTACK_SECRET_KEY</code> (first choice)</li>
                  <li><code className="bg-muted px-1 rounded">PAYSTACK_SECRET_KEY_TEST</code> (your variable)</li>
                  <li><code className="bg-muted px-1 rounded">PAYSTACK_SECRET_KEY_LIVE</code> (last choice)</li>
                </ol>
                <p className="mt-2 text-xs text-muted-foreground">
                  Since you have PAYSTACK_SECRET_KEY_TEST set, it should be found in the second check.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaystackEnvChecker;
