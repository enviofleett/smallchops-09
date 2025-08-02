import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegistrationDebug } from '@/services/registrationDebugService';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Search } from 'lucide-react';

interface TestResult {
  step: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const RegistrationHealth = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userStatus, setUserStatus] = useState<any>(null);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  
  const { runSystemTest, checkUserStatus, getLogs } = useRegistrationDebug();

  const handleRunTest = async () => {
    setIsRunningTest(true);
    setTestResults([]);
    
    try {
      const results = await runSystemTest();
      setTestResults(results);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResults([{
        step: 'test_execution',
        status: 'fail',
        message: 'Test execution failed',
        details: error
      }]);
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleCheckUser = async () => {
    if (!userEmail.trim()) return;
    
    setIsCheckingUser(true);
    setUserStatus(null);
    
    try {
      const status = await checkUserStatus(userEmail.trim());
      setUserStatus(status);
    } catch (error) {
      console.error('User check failed:', error);
      setUserStatus({ status: 'error', details: error });
    } finally {
      setIsCheckingUser(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200';
      case 'fail':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const overallStatus = testResults.length > 0 ? (
    testResults.some(r => r.status === 'fail') ? 'fail' :
    testResults.some(r => r.status === 'warning') ? 'warning' : 'pass'
  ) : 'unknown';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Registration System Health Check</span>
            {testResults.length > 0 && getStatusIcon(overallStatus)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={handleRunTest}
              disabled={isRunningTest}
              className="w-full"
            >
              {isRunningTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRunningTest ? 'Running System Test...' : 'Run Registration System Test'}
            </Button>

            {testResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Test Results:</h3>
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
                  >
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.step.replace(/_/g, ' ').toUpperCase()}</span>
                    </div>
                    <p className="text-sm mt-1">{result.message}</p>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-gray-600">Show Details</summary>
                        <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <h4 className="font-medium text-blue-800">Interpretation:</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    {overallStatus === 'pass' && "✅ All systems operational. Registration should work normally."}
                    {overallStatus === 'warning' && "⚠️ Some issues detected but registration may still work. Monitor for problems."}
                    {overallStatus === 'fail' && "❌ Critical issues found. Registration will likely fail until these are resolved."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Registration Status Checker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <div className="flex-1">
                <Label htmlFor="userEmail">User Email</Label>
                <Input
                  id="userEmail"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter email to check registration status"
                />
              </div>
              <Button 
                onClick={handleCheckUser}
                disabled={isCheckingUser || !userEmail.trim()}
                className="mt-6"
              >
                {isCheckingUser ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {userStatus && (
              <div className="space-y-3">
                <h3 className="font-semibold">User Status for: {userEmail}</h3>
                
                {userStatus.status === 'complete' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-3 rounded-lg border ${
                      userStatus.details.auth_user_exists 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center space-x-2">
                        {userStatus.details.auth_user_exists ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">Auth User</span>
                      </div>
                      <p className="text-sm mt-1">
                        {userStatus.details.auth_user_exists ? 'Exists' : 'Not found'}
                      </p>
                    </div>

                    <div className={`p-3 rounded-lg border ${
                      userStatus.details.customer_record_exists 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center space-x-2">
                        {userStatus.details.customer_record_exists ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">Customer Record</span>
                      </div>
                      <p className="text-sm mt-1">
                        {userStatus.details.customer_record_exists ? 'Created' : 'Missing'}
                      </p>
                    </div>

                    <div className={`p-3 rounded-lg border ${
                      userStatus.details.welcome_email_queued 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex items-center space-x-2">
                        {userStatus.details.welcome_email_queued ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                        <span className="font-medium">Welcome Email</span>
                      </div>
                      <p className="text-sm mt-1">
                        {userStatus.details.welcome_email_queued ? 'Queued' : 'Not queued'}
                      </p>
                    </div>
                  </div>
                )}

                {userStatus.details && (
                  <details className="mt-4">
                    <summary className="text-sm cursor-pointer text-gray-600">Show Full Details</summary>
                    <pre className="text-xs mt-2 p-4 bg-gray-100 rounded overflow-auto max-h-96">
                      {JSON.stringify(userStatus.details, null, 2)}
                    </pre>
                  </details>
                )}

                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <h4 className="font-medium text-blue-800">Diagnosis:</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    {userStatus.details?.auth_user_exists && userStatus.details?.customer_record_exists 
                      ? "✅ Registration completed successfully"
                      : userStatus.details?.auth_user_exists && !userStatus.details?.customer_record_exists
                      ? "⚠️ Auth user created but customer record missing - database trigger may have failed"
                      : !userStatus.details?.auth_user_exists
                      ? "❌ No registration found for this email"
                      : "❓ Unexpected state - please check manually"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Fixes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800">If "Database error updating user" persists:</h4>
              <ol className="list-decimal list-inside text-sm text-yellow-700 mt-2 space-y-1">
                <li>Run the SQL fixes provided above to ensure <code>template_variables</code> column exists</li>
                <li>Check that the <code>handle_new_user()</code> function is properly updated</li>
                <li>Verify RLS policies allow the service role to insert into tables</li>
                <li>Test with a new email address to avoid conflicts</li>
              </ol>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800">For Google OAuth issues:</h4>
              <ol className="list-decimal list-inside text-sm text-blue-700 mt-2 space-y-1">
                <li>Ensure Google OAuth is enabled in Supabase Dashboard</li>
                <li>Verify redirect URLs are properly configured</li>
                <li>Check that Google Client ID and Secret are set correctly</li>
                <li>Test with different Google accounts</li>
              </ol>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800">For phone number validation:</h4>
              <p className="text-sm text-green-700 mt-1">
                The fixed component now properly formats Nigerian phone numbers as "0912 002 0048" 
                for display but stores clean digits (09120020048) in the database.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistrationHealth;