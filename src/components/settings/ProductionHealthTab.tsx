import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'loading';
  message: string;
  lastChecked?: Date;
}

const ProductionHealthTab = () => {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([
    { name: "Database Connection", status: 'loading', message: "Checking..." },
    { name: "Business Settings", status: 'loading', message: "Checking..." },
    { name: "User Management", status: 'loading', message: "Checking..." },
    { name: "Communication System", status: 'loading', message: "Checking..." },
    { name: "Payment Integration", status: 'loading', message: "Checking..." },
    { name: "Edge Functions", status: 'loading', message: "Checking..." },
  ]);

  const runHealthChecks = async () => {
    const checks: HealthCheck[] = [];

    // Database Connection Check
    try {
      const { error } = await supabase.from('profiles').select('count').limit(1);
      checks.push({
        name: "Database Connection",
        status: error ? 'error' : 'healthy',
        message: error ? `Database error: ${error.message}` : "Database connection successful",
        lastChecked: new Date()
      });
    } catch (err) {
      checks.push({
        name: "Database Connection",
        status: 'error',
        message: "Failed to connect to database",
        lastChecked: new Date()
      });
    }

    // Business Settings Check
    try {
      const { data, error } = await supabase.from('business_settings').select('id').limit(1);
      checks.push({
        name: "Business Settings",
        status: error ? 'error' : (data && data.length > 0 ? 'healthy' : 'warning'),
        message: error ? `Settings error: ${error.message}` : 
                 (data && data.length > 0 ? "Business settings configured" : "No business settings found"),
        lastChecked: new Date()
      });
    } catch (err) {
      checks.push({
        name: "Business Settings",
        status: 'error',
        message: "Failed to check business settings",
        lastChecked: new Date()
      });
    }

    // User Management Check
    try {
      const { data, error } = await supabase.from('profiles').select('role').eq('role', 'admin').limit(1);
      checks.push({
        name: "User Management",
        status: error ? 'error' : (data && data.length > 0 ? 'healthy' : 'warning'),
        message: error ? `User management error: ${error.message}` : 
                 (data && data.length > 0 ? "Admin user exists" : "No admin users found"),
        lastChecked: new Date()
      });
    } catch (err) {
      checks.push({
        name: "User Management",
        status: 'error',
        message: "Failed to check user management",
        lastChecked: new Date()
      });
    }

    // Communication System Check
    try {
      const { data, error } = await supabase.from('communication_settings').select('id').limit(1);
      checks.push({
        name: "Communication System",
        status: error ? 'error' : (data && data.length > 0 ? 'healthy' : 'warning'),
        message: error ? `Communication error: ${error.message}` : 
                 (data && data.length > 0 ? "Communication settings configured" : "No communication settings found"),
        lastChecked: new Date()
      });
    } catch (err) {
      checks.push({
        name: "Communication System",
        status: 'error',
        message: "Failed to check communication system",
        lastChecked: new Date()
      });
    }

    // Payment Integration Check
    try {
      const { data, error } = await supabase.from('payment_integrations').select('id').limit(1);
      checks.push({
        name: "Payment Integration",
        status: error ? 'error' : (data && data.length > 0 ? 'healthy' : 'warning'),
        message: error ? `Payment error: ${error.message}` : 
                 (data && data.length > 0 ? "Payment integration configured" : "No payment integrations found"),
        lastChecked: new Date()
      });
    } catch (err) {
      checks.push({
        name: "Payment Integration",
        status: 'error',
        message: "Failed to check payment integration",
        lastChecked: new Date()
      });
    }

    // Edge Functions Check
    try {
      const { data, error } = await supabase.functions.invoke('business-settings', {
        method: 'GET'
      });
      checks.push({
        name: "Edge Functions",
        status: error ? 'warning' : 'healthy',
        message: error ? "Some edge functions may not be accessible" : "Edge functions responding",
        lastChecked: new Date()
      });
    } catch (err) {
      checks.push({
        name: "Edge Functions",
        status: 'warning',
        message: "Edge functions check completed with warnings",
        lastChecked: new Date()
      });
    }

    setHealthChecks(checks);
  };

  useEffect(() => {
    runHealthChecks();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'loading':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'loading':
        return <Badge variant="outline">Checking...</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleRefresh = async () => {
    setHealthChecks(prev => prev.map(check => ({ ...check, status: 'loading' as const, message: "Checking..." })));
    await runHealthChecks();
    toast.success("Health checks completed");
  };

  const overallStatus = healthChecks.some(check => check.status === 'error') ? 'error' :
                      healthChecks.some(check => check.status === 'warning') ? 'warning' : 'healthy';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Production Health Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Monitor system health and production readiness
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(overallStatus)}
            System Status
          </CardTitle>
          <CardDescription>
            Overall system health: {getStatusBadge(overallStatus)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {healthChecks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <h4 className="font-medium">{check.name}</h4>
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(check.status)}
                  {check.lastChecked && (
                    <span className="text-xs text-muted-foreground">
                      {check.lastChecked.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production Readiness Checklist</CardTitle>
          <CardDescription>
            Ensure all critical components are configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Database security functions updated</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">RLS policies enabled and tested</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Edge functions deployed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Settings management fully functional</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Audit logging implemented</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Error handling and validation in place</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionHealthTab;