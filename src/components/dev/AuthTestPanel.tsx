import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AuthTestUtility, AuthTestResult } from '@/utils/authTestUtility';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, XCircle, Play, User, Settings, Database } from 'lucide-react';

/**
 * Development component for testing authentication system
 * Only render this in development environment
 */
export const AuthTestPanel: React.FC = () => {
  const [testResults, setTestResults] = useState<AuthTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const authStatus = useAuthStatus();
  const authContext = useAuth();

  const runTests = async () => {
    setIsRunning(true);
    try {
      const results = await AuthTestUtility.runAllTests();
      setTestResults(results);
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getStatusBadge = (passed: boolean) => {
    return (
      <Badge variant={passed ? "default" : "destructive"}>
        {passed ? "PASS" : "FAIL"}
      </Badge>
    );
  };

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="p-4 space-y-4 bg-yellow-50 border-l-4 border-yellow-400">
      <div className="flex items-center gap-2 text-yellow-800">
        <Settings className="h-5 w-5" />
        <h3 className="font-semibold">Authentication System Test Panel (Development Only)</h3>
      </div>

      {/* Current Auth Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" />
            Current Authentication Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">useAuthStatus:</span>
              <div className="font-mono">
                <div>Authenticated: {authStatus.isAuthenticated ? '✅' : '❌'}</div>
                <div>Loading: {authStatus.isLoading ? '⏳' : '✅'}</div>
                <div>User Type: {authStatus.userType || 'None'}</div>
                <div>Has Admin: {authStatus.hasAdminPrivileges ? '✅' : '❌'}</div>
                <div>Email: {authStatus.user?.email || 'None'}</div>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">AuthContext:</span>
              <div className="font-mono">
                <div>Authenticated: {authContext.isAuthenticated ? '✅' : '❌'}</div>
                <div>Loading: {authContext.isLoading ? '⏳' : '✅'}</div>
                <div>User Type: {authContext.userType || 'None'}</div>
                <div>Role: {authContext.user?.role || 'None'}</div>
                <div>Email: {authContext.user?.email || 'None'}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Runner */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            Database & System Tests
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Running Tests...' : 'Run Authentication Tests'}
          </Button>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Test Results</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.passed)}
                    <span className="font-medium text-sm">{result.test}</span>
                  </div>
                  {getStatusBadge(result.passed)}
                </div>
                <p className="text-sm text-muted-foreground">{result.message}</p>
                {result.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Show Details
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span>Overall Status:</span>
                <Badge variant={testResults.every(r => r.passed) ? "default" : "destructive"}>
                  {testResults.filter(r => r.passed).length}/{testResults.length} PASSED
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
