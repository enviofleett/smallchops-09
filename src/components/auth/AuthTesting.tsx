import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useOTPAuth } from '@/hooks/useOTPAuth';
import { useRegistrationDebug } from '@/services/registrationDebugService';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, TestTube, User, Mail, AlertCircle, CheckCircle } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  duration?: number;
}

const AuthTesting = () => {
  const { toast } = useToast();
  const { login, signUp, resetPassword } = useAuth();
  const { logout: customerLogout } = useCustomerAuth();
  const { sendOTP, verifyOTP } = useOTPAuth();
  const { runSystemTest, checkUserStatus } = useRegistrationDebug();

  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [userStatusResults, setUserStatusResults] = useState<any>(null);

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const runAuthTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const tests = [
      {
        name: 'System Health Check',
        test: async () => {
          const results = await runSystemTest();
          const failedTests = results.filter(r => r.status === 'fail');
          if (failedTests.length > 0) {
            throw new Error(`${failedTests.length} system tests failed`);
          }
          return `All ${results.length} system tests passed`;
        }
      },
      {
        name: 'Admin Registration',
        test: async () => {
          try {
            await signUp({
              email: `admin-test-${Date.now()}@example.com`,
              password: 'testpass123',
              name: 'Test Admin'
            });
            return 'Admin registration successful';
          } catch (error: any) {
            if (error.message.includes('already registered')) {
              return 'Admin registration validation working (user exists)';
            }
            throw error;
          }
        }
      },
      {
        name: 'Customer OTP Flow',
        test: async () => {
          const email = `customer-test-${Date.now()}@example.com`;
          const result = await sendOTP(email, 'login');
          if (!result.success) {
            throw new Error(result.error || 'OTP send failed');
          }
          return 'OTP generation and sending successful';
        }
      },
      {
        name: 'Password Reset Flow',
        test: async () => {
          await resetPassword(testEmail);
          return 'Password reset email sent successfully';
        }
      },
      {
        name: 'Rate Limiting',
        test: async () => {
          // Test rate limiting by sending multiple OTP requests
          const email = `rate-test-${Date.now()}@example.com`;
          const promises = Array(6).fill(null).map(() => sendOTP(email, 'login'));
          const results = await Promise.allSettled(promises);
          
          const rateLimited = results.some(result => 
            result.status === 'fulfilled' && result.value.rateLimited
          );
          
          if (rateLimited) {
            return 'Rate limiting is working correctly';
          } else {
            throw new Error('Rate limiting not triggered as expected');
          }
        }
      }
    ];

    for (const { name, test } of tests) {
      addTestResult({ name, status: 'pending', message: 'Running...' });
      
      try {
        const startTime = Date.now();
        const message = await test();
        const duration = Date.now() - startTime;
        
        setTestResults(prev => 
          prev.map(result => 
            result.name === name 
              ? { ...result, status: 'success', message, duration }
              : result
          )
        );
      } catch (error: any) {
        setTestResults(prev => 
          prev.map(result => 
            result.name === name 
              ? { ...result, status: 'error', message: error.message || 'Test failed' }
              : result
          )
        );
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
    
    const failedCount = testResults.filter(r => r.status === 'error').length;
    toast({
      title: "Authentication Tests Complete",
      description: `${testResults.length - failedCount} passed, ${failedCount} failed`,
      variant: failedCount > 0 ? "destructive" : "default"
    });
  };

  const checkUser = async () => {
    if (!testEmail) {
      toast({
        title: "Email required",
        description: "Please enter an email to check user status",
        variant: "destructive"
      });
      return;
    }

    try {
      const status = await checkUserStatus(testEmail);
      setUserStatusResults(status);
    } catch (error: any) {
      toast({
        title: "User status check failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: 'success' | 'error' | 'pending') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-orange-600" />;
    }
  };

  const getStatusBadge = (status: 'success' | 'error' | 'pending') => {
    const variants = {
      success: 'default' as const,
      error: 'destructive' as const,
      pending: 'secondary' as const
    };
    
    return (
      <Badge variant={variants[status]} className="ml-2">
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-5 w-5" />
            <span>Authentication Testing Suite</span>
          </CardTitle>
          <CardDescription>
            Test all authentication flows and system health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tests" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tests">Run Tests</TabsTrigger>
              <TabsTrigger value="user-check">User Status</TabsTrigger>
            </TabsList>
            
            <TabsContent value="tests" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Run comprehensive tests on all authentication components
                </p>
                <Button 
                  onClick={runAuthTests} 
                  disabled={isRunning}
                  className="min-w-32"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Run All Tests'
                  )}
                </Button>
              </div>

              {testResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Test Results</h3>
                  <div className="space-y-2">
                    {testResults.map((result, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(result.status)}
                          <span className="font-medium">{result.name}</span>
                          {getStatusBadge(result.status)}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{result.message}</p>
                          {result.duration && (
                            <p className="text-xs text-muted-foreground">
                              {result.duration}ms
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="user-check" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">User Email</Label>
                <div className="flex space-x-2">
                  <Input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Enter email to check status"
                  />
                  <Button onClick={checkUser}>
                    <User className="mr-2 h-4 w-4" />
                    Check Status
                  </Button>
                </div>
              </div>

              {userStatusResults && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">User Status Results</h3>
                  <div className="p-4 border rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Overall Status</p>
                        <Badge variant={userStatusResults.success ? "default" : "destructive"}>
                          {userStatusResults.success ? "Healthy" : "Issues Found"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Message</p>
                        <p className="text-sm text-muted-foreground">{userStatusResults.message}</p>
                      </div>
                    </div>
                    
                    {userStatusResults.details && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Detailed Status</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(userStatusResults.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthTesting;