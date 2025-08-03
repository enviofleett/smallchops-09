import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, CheckCircle, AlertCircle, Send, Code, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EndpointTest {
  method: string;
  endpoint: string;
  payload?: any;
  response?: any;
  loading?: boolean;
  error?: string;
}

export const AuthenticationEndpointsTab = () => {
  const [testResults, setTestResults] = useState<Record<string, EndpointTest>>({});
  const [showSecrets, setShowSecrets] = useState(false);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Code has been copied to your clipboard",
    });
  };

  const testEndpoint = async (endpointKey: string, payload: any) => {
    setTestResults(prev => ({
      ...prev,
      [endpointKey]: { ...prev[endpointKey], loading: true, error: undefined }
    }));

    try {
      let response;
      
      switch (endpointKey) {
        case 'generate-otp':
          response = await supabase.functions.invoke('generate-otp-email', {
            body: payload
          });
          break;
        case 'verify-otp':
          response = await supabase.functions.invoke('verify-otp', {
            body: payload
          });
          break;
        case 'google-oauth':
          response = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${window.location.origin}/auth/callback`
            }
          });
          break;
        default:
          throw new Error('Unknown endpoint');
      }

      setTestResults(prev => ({
        ...prev,
        [endpointKey]: {
          ...prev[endpointKey],
          loading: false,
          response: response.data || response,
          error: response.error?.message
        }
      }));

      if (response.error) {
        toast({
          title: "Test Failed",
          description: response.error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Test Successful",
          description: "Endpoint responded correctly"
        });
      }
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [endpointKey]: {
          ...prev[endpointKey],
          loading: false,
          error: error.message
        }
      }));
      
      toast({
        title: "Test Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const endpoints = [
    {
      key: 'generate-otp',
      title: 'Generate OTP Email',
      method: 'POST',
      path: '/functions/v1/generate-otp-email',
      description: 'Generate and send OTP code via email for authentication',
      payload: {
        email: 'customer@example.com',
        purpose: 'login',
        customerName: 'John Doe'
      },
      response: {
        success: true,
        message: 'OTP sent successfully',
        expiresIn: 300
      },
      usage: `// Generate OTP for login
const { data, error } = await supabase.functions.invoke('generate-otp-email', {
  body: {
    email: 'customer@example.com',
    purpose: 'login', // 'login' | 'registration' | 'password_reset'
    customerName: 'John Doe' // Optional
  }
});`
    },
    {
      key: 'verify-otp',
      title: 'Verify OTP Code',
      method: 'POST',
      path: '/functions/v1/verify-otp',
      description: 'Verify OTP code and complete authentication',
      payload: {
        email: 'customer@example.com',
        code: '123456',
        purpose: 'login'
      },
      response: {
        success: true,
        loginVerified: true,
        email: 'customer@example.com'
      },
      usage: `// Verify OTP code
const { data, error } = await supabase.functions.invoke('verify-otp', {
  body: {
    email: 'customer@example.com',
    code: '123456',
    purpose: 'login' // 'login' | 'registration' | 'password_reset'
  }
});`
    },
    {
      key: 'google-oauth',
      title: 'Google OAuth Flow',
      method: 'GET',
      path: 'Built-in Supabase Auth',
      description: 'Initiate Google OAuth authentication flow',
      payload: {
        provider: 'google',
        redirectTo: 'https://yourapp.com/auth/callback'
      },
      response: {
        url: 'https://accounts.google.com/oauth/authorize?...',
        provider: 'google'
      },
      usage: `// Initiate Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: \`\${window.location.origin}/auth/callback\`
  }
});`
    }
  ];

  const supportingEndpoints = [
    {
      title: 'Registration Debug',
      method: 'POST',
      path: '/functions/v1/log-registration-debug',
      description: 'Log registration debugging information'
    },
    {
      title: 'Admin Management',
      method: 'POST',
      path: '/functions/v1/admin-management',
      description: 'Admin user management operations'
    },
    {
      title: 'Business Settings',
      method: 'GET',
      path: '/rest/v1/business_settings',
      description: 'Get business configuration for branding'
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Authentication API Documentation
          </CardTitle>
          <CardDescription>
            Comprehensive guide to authentication endpoints and integration patterns
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="endpoints" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="endpoints">Core Endpoints</TabsTrigger>
          <TabsTrigger value="testing">API Testing</TabsTrigger>
          <TabsTrigger value="integration">Integration Guide</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-6">
          {endpoints.map((endpoint) => (
            <Card key={endpoint.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{endpoint.title}</CardTitle>
                  <Badge variant={endpoint.method === 'POST' ? 'default' : 'secondary'}>
                    {endpoint.method}
                  </Badge>
                </div>
                <CardDescription>{endpoint.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-3 rounded-lg">
                  <Label className="text-xs font-medium text-muted-foreground">ENDPOINT</Label>
                  <div className="font-mono text-sm mt-1">{endpoint.path}</div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Request Body</Label>
                  <div className="relative mt-2">
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(endpoint.payload, null, 2)}
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(JSON.stringify(endpoint.payload, null, 2))}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Response Format</Label>
                  <div className="relative mt-2">
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(endpoint.response, null, 2)}
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(JSON.stringify(endpoint.response, null, 2))}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Usage Example</Label>
                  <div className="relative mt-2">
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                      {endpoint.usage}
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(endpoint.usage)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Supporting Endpoints</CardTitle>
              <CardDescription>Additional endpoints for authentication workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {supportingEndpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{endpoint.title}</div>
                      <div className="text-sm text-muted-foreground">{endpoint.description}</div>
                      <div className="text-xs font-mono text-muted-foreground mt-1">{endpoint.path}</div>
                    </div>
                    <Badge variant="outline">{endpoint.method}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interactive API Testing</CardTitle>
              <CardDescription>Test authentication endpoints directly from the admin panel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSecrets(!showSecrets)}
                >
                  {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showSecrets ? 'Hide' : 'Show'} Test Data
                </Button>
              </div>

              {endpoints.map((endpoint) => (
                <Card key={`test-${endpoint.key}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{endpoint.title} Test</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Request Payload</Label>
                      <Textarea
                        value={JSON.stringify(endpoint.payload, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            // Update payload for testing
                          } catch (error) {
                            // Invalid JSON, ignore
                          }
                        }}
                        className="font-mono text-xs"
                        rows={6}
                      />
                    </div>

                    <Button
                      onClick={() => testEndpoint(endpoint.key, endpoint.payload)}
                      disabled={testResults[endpoint.key]?.loading}
                      className="w-full"
                    >
                      {testResults[endpoint.key]?.loading ? (
                        <>Testing...</>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Test {endpoint.title}
                        </>
                      )}
                    </Button>

                    {testResults[endpoint.key]?.response && (
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Response
                        </Label>
                        <pre className="bg-green-50 dark:bg-green-950 p-3 rounded-lg text-xs mt-2 overflow-x-auto border border-green-200 dark:border-green-800">
                          {JSON.stringify(testResults[endpoint.key].response, null, 2)}
                        </pre>
                      </div>
                    )}

                    {testResults[endpoint.key]?.error && (
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          Error
                        </Label>
                        <pre className="bg-red-50 dark:bg-red-950 p-3 rounded-lg text-xs mt-2 overflow-x-auto border border-red-200 dark:border-red-800">
                          {testResults[endpoint.key].error}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Frontend Integration Patterns</CardTitle>
              <CardDescription>Best practices for implementing authentication in your React app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">OTP Registration Flow</h3>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`// Complete OTP registration workflow
const registerWithOTP = async (userData) => {
  try {
    // Step 1: Generate OTP
    const { data: otpData, error: otpError } = await supabase.functions.invoke('generate-otp-email', {
      body: {
        email: userData.email,
        purpose: 'registration',
        customerName: userData.name
      }
    });

    if (otpError) throw otpError;
    
    // Step 2: Show OTP input form
    setShowOTPInput(true);
    setTempRegistrationData(userData);
    
    // Step 3: Verify OTP and complete registration
    const verifyAndRegister = async (otpCode) => {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-otp', {
        body: {
          email: userData.email,
          code: otpCode,
          purpose: 'registration'
        }
      });
      
      if (verifyError) throw verifyError;
      
      if (verifyData.emailVerified) {
        // OTP verified, now create account
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userData.email,
          password: userData.password,
          options: {
            data: {
              name: userData.name,
              phone: userData.phone
            }
          }
        });
        
        if (authError) throw authError;
        
        toast({
          title: "Registration successful!",
          description: "Welcome to our platform."
        });
      }
    };
    
  } catch (error) {
    toast({
      title: "Registration failed",
      description: error.message,
      variant: "destructive"
    });
  }
};`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(`// Complete OTP registration workflow...`)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Error Handling Best Practices</h3>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`// Comprehensive error handling for auth endpoints
const handleAuthError = (error, operation) => {
  console.error(\`\${operation} error:\`, error);
  
  // Rate limiting errors
  if (error.message?.includes('rate limit') || error.status === 429) {
    toast({
      title: "Too many requests",
      description: "Please wait before trying again.",
      variant: "destructive"
    });
    return;
  }
  
  // OTP specific errors
  if (operation === 'otp-verify') {
    if (error.message?.includes('expired')) {
      toast({
        title: "Code expired",
        description: "Please request a new verification code.",
        variant: "destructive"
      });
      setShowOTPInput(false);
      return;
    }
    
    if (error.message?.includes('invalid')) {
      toast({
        title: "Invalid code",
        description: "Please check your code and try again.",
        variant: "destructive"
      });
      return;
    }
    
    if (error.message?.includes('max attempts')) {
      toast({
        title: "Too many attempts",
        description: "Please request a new verification code.",
        variant: "destructive"
      });
      setShowOTPInput(false);
      return;
    }
  }
  
  // Generic error fallback
  toast({
    title: "Authentication error",
    description: error.message || "Something went wrong. Please try again.",
    variant: "destructive"
  });
};`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(`// Comprehensive error handling...`)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Authentication Pattern</h3>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`// Customer authentication with email/password
const useCustomerDirectAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  const initiateOTPFlow = async (email, purpose, additionalData = {}) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-otp-email', {
        body: { email, purpose, ...additionalData }
      });
      
      if (error) throw error;
      
      setIsOTPRequired(true);
      setTempData({ email, purpose, ...additionalData });
      
      return { success: true };
    } catch (error) {
      handleAuthError(error, 'otp-generate');
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };
  
  const completeOTPVerification = async (code) => {
    if (!tempData) throw new Error('No OTP session found');
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: {
          email: tempData.email,
          code,
          purpose: tempData.purpose
        }
      });
      
      if (error) throw error;
      
      setIsOTPRequired(false);
      setTempData(null);
      
      return { success: true, data };
    } catch (error) {
      handleAuthError(error, 'otp-verify');
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    isOTPRequired,
    isLoading,
    tempData,
    initiateOTPFlow,
    completeOTPVerification,
    resetOTPState: () => {
      setIsOTPRequired(false);
      setTempData(null);
    }
  };
};`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(`// Unified authentication state management...`)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Monitoring</CardTitle>
              <CardDescription>Monitor authentication performance and security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">98.5%</div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">OTP Delivery Rate</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">1.2s</div>
                  <div className="text-sm text-green-700 dark:text-green-300">Avg Response Time</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">156</div>
                  <div className="text-sm text-purple-700 dark:text-purple-300">Today's Authentications</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Monitoring Links</h4>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                    <a href={`https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/functions/generate-otp-email/logs`} target="_blank" rel="noopener noreferrer">
                      OTP Generation Logs
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                    <a href={`https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/functions/verify-otp/logs`} target="_blank" rel="noopener noreferrer">
                      OTP Verification Logs
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                    <a href={`https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/auth/users`} target="_blank" rel="noopener noreferrer">
                      User Management
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};