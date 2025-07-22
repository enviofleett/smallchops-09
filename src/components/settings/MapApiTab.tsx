
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useMapUsageAnalytics } from '@/hooks/useMapUsageAnalytics';
import { useMapSettings } from '@/hooks/useMapSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Info } from 'lucide-react';

const settingsSchema = z.object({
  monthly_usage_limit: z.coerce.number().min(0, "Limit must be a positive number."),
  usage_alert_email: z.string().email("Invalid email address.").or(z.literal('')),
  usage_alert_threshold: z.coerce.number().min(0).max(100, "Threshold must be between 0 and 100."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const MapApiTab = () => {
  const { data: analytics, isLoading: isLoadingAnalytics, error: analyticsError } = useMapUsageAnalytics();
  const { data: settings, isLoading: isLoadingSettings, error: settingsError, updateSettings, isUpdating } = useMapSettings();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      monthly_usage_limit: 0,
      usage_alert_email: '',
      usage_alert_threshold: 80,
    },
  });

  React.useEffect(() => {
    if (settings) {
      form.reset({
        monthly_usage_limit: settings.monthly_usage_limit ?? 0,
        usage_alert_email: settings.usage_alert_email ?? '',
        usage_alert_threshold: settings.usage_alert_threshold ?? 80,
      });
    }
  }, [settings, form]);

  const onSubmit = (values: SettingsFormValues) => {
    updateSettings(values);
  };
  
  if (isLoadingAnalytics || isLoadingSettings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (analyticsError || settingsError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          { analyticsError?.message || settingsError?.message || 'Failed to load map API settings.'}
        </AlertDescription>
      </Alert>
    );
  }

  const usagePercentage = analytics && analytics.monthlyLimit > 0
    ? (analytics.totalUsage / analytics.monthlyLimit) * 100
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Map API Key</CardTitle>
          <CardDescription>
            The Map API key is managed as a secret for security.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Secret Management</AlertTitle>
            <AlertDescription>
              Your MapTiler API Key should be set as a secret named `MAPTILER_API_KEY` in your project's environment settings. This key is automatically used by the application.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Usage</CardTitle>
          <CardDescription>
            API requests for the current month.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">{analytics?.totalUsage.toLocaleString()}</p>
            </div>
            <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Monthly Limit</p>
              <p className="text-2xl font-bold">{analytics?.monthlyLimit.toLocaleString()}</p>
            </div>
            <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Usage</p>
              <p className="text-2xl font-bold">{usagePercentage.toFixed(2)}%</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Usage Settings</CardTitle>
          <CardDescription>
            Configure your monthly usage limits and alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="monthly_usage_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Usage Limit</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 100000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usage_alert_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage Alert Email</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., admin@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usage_alert_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage Alert Threshold (%)</FormLabel>
                    <FormControl>
                       <Input type="number" placeholder="e.g., 80" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MapApiTab;
