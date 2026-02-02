import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Monitor, 
  MapPin, 
  Clock, 
  Shield, 
  X,
  AlertTriangle,
  Smartphone,
  Globe
} from 'lucide-react';

interface AdminSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address?: string | null;
  user_agent?: string | null;
  expires_at: string;
  last_activity: string;
  is_active: boolean;
  created_at: string;
  terminated_at?: string | null;
  termination_reason?: string | null;
}

interface SessionWithProfile extends AdminSession {
  profile?: {
    name: string;
    email: string;
    role: string;
  };
}

export const EnhancedSessionManager = () => {
  const [sessions, setSessions] = useState<SessionWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      // Load admin sessions with profile information
      const { data: sessionsData, error: sessionsError } = await (supabase as any)
        .from('admin_sessions')
        .select(`
          *,
          profiles:user_id (
            name,
            email,
            role
          )
        `)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Transform the data to match our interface
      const transformedSessions = sessionsData?.map(session => ({
        ...session,
        ip_address: session.ip_address as string | null,
        user_agent: session.user_agent as string | null,
        terminated_at: session.terminated_at as string | null,
        termination_reason: session.termination_reason as string | null,
        profile: Array.isArray(session.profiles) ? session.profiles[0] : session.profiles
      })) || [];

      setSessions(transformedSessions);

    } catch (error: any) {
      console.error('Error loading sessions:', error);
      toast({
        title: "Error loading sessions",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createSession = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await (supabase as any).rpc('create_admin_session', {
        p_user_id: user.id,
        p_ip_address: null, // Will be auto-detected by the function
        p_user_agent: navigator.userAgent
      });

      if (error) throw error;

      toast({
        title: "Session created",
        description: "New admin session has been created successfully"
      });

      loadSessions();
    } catch (error: any) {
      toast({
        title: "Error creating session",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('admin_sessions')
        .update({ 
          is_active: false,
          terminated_at: new Date().toISOString(),
          termination_reason: 'manually_terminated'
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session terminated",
        description: "Admin session has been terminated successfully"
      });

      loadSessions();
    } catch (error: any) {
      toast({
        title: "Error terminating session",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const validateSession = async (sessionToken: string) => {
    try {
      const { data, error } = await (supabase as any).rpc('validate_admin_session', {
        p_session_token: sessionToken,
        p_ip_address: null
      });

      if (error) throw error;

      const result = data as { valid: boolean; reason?: string };
      toast({
        title: "Session validation",
        description: result.valid ? "Session is valid" : `Invalid: ${result.reason}`,
        variant: result.valid ? "default" : "destructive"
      });

    } catch (error: any) {
      toast({
        title: "Error validating session",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadSessions();
    
    // Set up real-time subscription for session updates
    const subscription = supabase
      .channel('admin_sessions')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'admin_sessions' 
      }, loadSessions)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getDeviceInfo = (userAgent?: string) => {
    if (!userAgent) return { device: 'Unknown', browser: 'Unknown' };
    
    let device = 'Desktop';
    let browser = 'Unknown';

    // Simple device detection
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      device = /iPad/.test(userAgent) ? 'Tablet' : 'Mobile';
    }

    // Simple browser detection
    if (/Chrome/.test(userAgent)) browser = 'Chrome';
    else if (/Firefox/.test(userAgent)) browser = 'Firefox';
    else if (/Safari/.test(userAgent)) browser = 'Safari';
    else if (/Edge/.test(userAgent)) browser = 'Edge';

    return { device, browser };
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expiryTime = new Date(expiresAt).getTime();
    const now = new Date().getTime();
    const hoursUntilExpiry = (expiryTime - now) / (1000 * 60 * 60);
    return hoursUntilExpiry <= 2; // Expiring in 2 hours or less
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Session Management</h2>
          <p className="text-muted-foreground">Monitor and manage active admin sessions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={createSession} variant="outline">
            <Shield className="h-4 w-4 mr-2" />
            Create Session
          </Button>
          <Button onClick={loadSessions} variant="outline">
            <Monitor className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Session Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently active admin sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(sessions.map(s => s.user_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Distinct users with active sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {sessions.filter(s => isExpiringSoon(s.expires_at)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Sessions expiring within 2 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Admin Sessions</CardTitle>
          <CardDescription>
            All currently active admin sessions with security details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No active admin sessions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const { device, browser } = getDeviceInfo(session.user_agent);
                const expiringSoon = isExpiringSoon(session.expires_at);
                const isCurrentUser = session.user_id === user?.id;
                
                return (
                  <div key={session.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {device === 'Mobile' ? (
                            <Smartphone className="h-4 w-4" />
                          ) : (
                            <Monitor className="h-4 w-4" />
                          )}
                          <div>
                            <div className="font-medium">
                              {session.profile?.name || 'Unknown User'}
                              {isCurrentUser && (
                                <Badge variant="outline" className="ml-2">You</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {session.profile?.email} • {session.profile?.role}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="default">{device}</Badge>
                          <Badge variant="outline">{browser}</Badge>
                          {expiringSoon && (
                            <Badge variant="destructive">
                              <Clock className="h-3 w-3 mr-1" />
                              Expiring Soon
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => validateSession(session.session_token)}
                        >
                          Validate
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => terminateSession(session.id)}
                          disabled={isCurrentUser}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{session.ip_address || 'Unknown IP'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Created: {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Last Active: {new Date(session.last_activity).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Expires: {new Date(session.expires_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {expiringSoon && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          This session will expire soon. The user should refresh their session.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};