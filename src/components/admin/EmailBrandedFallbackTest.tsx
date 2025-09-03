import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mail,
  TestTube,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface TestResult {
  templateKey: string;
  success: boolean;
  fallbackUsed: boolean;
  fallbackMode?: string;
  error?: string;
  messageId?: string;
}

export const EmailBrandedFallbackTest: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  // Test templates - mix of existing and non-existing to test fallback
  const testTemplates = [
    { key: 'order_status_update', name: 'Order Status Update', shouldFallback: true },
    { key: 'order_confirmation', name: 'Order Confirmation', shouldFallback: true },
    { key: 'customer_welcome', name: 'Customer Welcome', shouldFallback: true },
    { key: 'admin_status_update', name: 'Admin Status Update', shouldFallback: true }
  ];

  const runBrandedFallbackTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    const results: TestResult[] = [];
    
    try {
      for (const template of testTemplates) {
        try {
          console.log(`Testing branded fallback for template: ${template.key}`);
          
          const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
            body: {
              to: 'test@example.com', // Using test email for safety
              templateKey: template.key,
              variables: {
                customer_name: 'Test Customer',
                order_number: 'TEST-001',
                status: 'confirmed',
                total_amount: '2500',
                business_name: 'Test Business',
                delivery_address: '123 Test Street, Test City'
              },
              debug: true
            }
          });

          if (error) {
            results.push({
              templateKey: template.key,
              success: false,
              fallbackUsed: false,
              error: error.message
            });
          } else if (data?.success) {
            results.push({
              templateKey: template.key,
              success: true,
              fallbackUsed: data.metadata?.fallbackUsed || false,
              fallbackMode: data.metadata?.fallbackMode,
              messageId: data.messageId
            });
          } else {
            results.push({
              templateKey: template.key,
              success: false,
              fallbackUsed: false,
              error: data?.error || 'Unknown error'
            });
          }
        } catch (err: any) {
          results.push({
            templateKey: template.key,
            success: false,
            fallbackUsed: false,
            error: err.message
          });
        }
      }

      setTestResults(results);
      
      const successCount = results.filter(r => r.success).length;
      const fallbackCount = results.filter(r => r.fallbackUsed).length;
      
      toast({
        title: "Branded Fallback Test Complete",
        description: `${successCount}/${results.length} templates tested successfully. ${fallbackCount} used branded fallbacks.`,
        variant: successCount === results.length ? "default" : "destructive",
      });

    } catch (error: any) {
      console.error('Branded fallback test failed:', error);
      toast({
        title: "Test Failed",
        description: "Failed to run branded fallback test",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Branded Fallback System Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Test the branded fallback system with common email templates
          </p>
          <Button 
            onClick={runBrandedFallbackTest} 
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Run Test
              </>
            )}
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Test Results</h4>
            <div className="grid gap-3">
              {testResults.map((result) => (
                <div
                  key={result.templateKey}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{result.templateKey}</p>
                      {result.error && (
                        <p className="text-xs text-red-600">{result.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? 'Success' : 'Failed'}
                    </Badge>
                    {result.fallbackUsed && (
                      <Badge variant="outline" className="gap-1">
                        <Mail className="h-3 w-3" />
                        {result.fallbackMode === 'branded' ? 'Branded Fallback' : 'Basic Fallback'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            <strong>Test Purpose:</strong> This test verifies that the branded fallback system works correctly 
            for templates that may not exist in the database. Tests use a safe test email address and will 
            not send actual emails to customers.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};