import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface WelcomeEmailStats {
  total_queued: number;
  total_sent: number;
  total_failed: number;
  google_oauth_count: number;
  email_signup_count: number;
  processing_rate: number;
  last_processed: string | null;
}

interface RecentEvent {
  id: string;
  recipient_email: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  auth_provider: string;
  error_message: string | null;
}

export const WelcomeEmailMonitor = () => {
  const [stats, setStats] = useState<WelcomeEmailStats>({
    total_queued: 0,
    total_sent: 0,
    total_failed: 0,
    google_oauth_count: 0,
    email_signup_count: 0,
    processing_rate: 0,
    last_processed: null
  });
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fetchWelcomeEmailStats = async () => {
    try {
      // Get welcome email statistics
      const { data: eventsStats, error: statsError } = await supabase
        .from('communication_events')
        .select('status, variables, created_at, sent_at')
        .eq('event_type', 'customer_welcome')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (statsError) throw statsError;

      // Calculate statistics
      const total_queued = eventsStats?.filter(e => e.status === 'queued').length || 0;
      const total_sent = eventsStats?.filter(e => e.status === 'sent').length || 0;
      const total_failed = eventsStats?.filter(e => e.status === 'failed').length || 0;
      
      const google_oauth_count = eventsStats?.filter(e => {
        const vars = e.variables as any;
        return vars?.authProvider === 'google' || vars?.isOAuth === true;
      }).length || 0;
      
      const email_signup_count = eventsStats?.filter(e => {
        const vars = e.variables as any;
        return vars?.authProvider === 'email' || (!vars?.authProvider && !vars?.isOAuth);
      }).length || 0;

      const sentEvents = eventsStats?.filter(e => e.status === 'sent' && e.sent_at) || [];
      const processing_rate = sentEvents.length > 0 
        ? sentEvents.reduce((sum, event) => {
            const created = new Date(event.created_at).getTime();
            const sent = new Date(event.sent_at!).getTime();
            return sum + (sent - created);
          }, 0) / sentEvents.length / 1000 // Average seconds
        : 0;

      const last_processed = sentEvents.length > 0 ? sentEvents[0].sent_at : null;

      setStats({
        total_queued,
        total_sent,
        total_failed,
        google_oauth_count,
        email_signup_count,
        processing_rate,
        last_processed
      });

      // Get recent events for detailed view
      const { data: recentEventsData, error: eventsError } = await supabase
        .from('communication_events')
        .select('id, recipient_email, status, created_at, sent_at, variables, error_message')
        .eq('event_type', 'customer_welcome')
        .order('created_at', { ascending: false })
        .limit(10);

      if (eventsError) throw eventsError;

      const formattedEvents = recentEventsData?.map(event => {
        const vars = event.variables as any;
        return {
          id: event.id,
          recipient_email: event.recipient_email,
          status: event.status,
          created_at: event.created_at,
          sent_at: event.sent_at,
          auth_provider: vars?.authProvider || 'email',
          error_message: event.error_message
        };
      }) || [];

      setRecentEvents(formattedEvents);

    } catch (error: any) {
      console.error('Error fetching welcome email stats:', error);
      toast({
        title: "Failed to load stats",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const triggerInstantProcessing = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('instant-welcome-processor');
      
      if (error) throw error;

      toast({
        title: "Processing triggered",
        description: `${data.successful || 0} emails sent, ${data.failed || 0} failed`,
      });

      // Refresh stats
      await fetchWelcomeEmailStats();
    } catch (error: any) {
      console.error('Error triggering instant processing:', error);
      toast({
        title: "Processing failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchWelcomeEmailStats();
      setIsLoading(false);
    };

    loadData();

    // Set up real-time monitoring
    const interval = setInterval(fetchWelcomeEmailStats, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'queued':
        return <Mail className="h-4 w-4 text-blue-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'queued':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading welcome email monitoring...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Queued</p>
                <p className="text-2xl font-bold">{stats.total_queued}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Sent (24h)</p>
                <p className="text-2xl font-bold">{stats.total_sent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Failed (24h)</p>
                <p className="text-2xl font-bold">{stats.total_failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Processing</p>
              <p className="text-2xl font-bold">{stats.processing_rate.toFixed(1)}s</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auth Provider Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Welcome Email Sources (24h)
            <Button 
              onClick={triggerInstantProcessing} 
              disabled={isProcessing}
              size="sm"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Process Queued
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="font-medium">Google OAuth</span>
              </div>
              <span className="text-2xl font-bold">{stats.google_oauth_count}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Mail className="h-6 w-6 text-green-600" />
                <span className="font-medium">Email Signup</span>
              </div>
              <span className="text-2xl font-bold">{stats.email_signup_count}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Welcome Emails</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent welcome emails found</p>
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(event.status)}
                    <div>
                      <p className="font-medium text-sm">{event.recipient_email}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.created_at).toLocaleString()} • {event.auth_provider}
                      </p>
                      {event.error_message && (
                        <p className="text-xs text-red-600 mt-1">{event.error_message}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={getStatusColor(event.status)}>
                    {event.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Production Alerts */}
      {stats.total_failed > 5 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-800">High Failure Rate Alert</p>
                <p className="text-sm text-red-600">
                  {stats.total_failed} welcome emails failed in the last 24 hours. Check SMTP settings and email templates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};