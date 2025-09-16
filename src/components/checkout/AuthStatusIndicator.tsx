import React from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useGuestSession } from '@/hooks/useGuestSession';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Shield, Clock, AlertTriangle } from 'lucide-react';

interface AuthStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export const AuthStatusIndicator: React.FC<AuthStatusIndicatorProps> = ({ 
  showDetails = false, 
  className 
}) => {
  const { user, session, isAuthenticated, isLoading } = useCustomerAuth();
  const { guestSession } = useGuestSession();

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Clock className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Checking authentication...</span>
      </div>
    );
  }

  const hasValidAuth = isAuthenticated && session?.access_token;
  const hasGuestSession = guestSession?.sessionId;
  const sessionExpiry = session?.expires_at ? new Date(session.expires_at * 1000) : null;
  const isExpiringSoon = sessionExpiry ? 
    (sessionExpiry.getTime() - Date.now()) < 5 * 60 * 1000 : false;

  if (!showDetails) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {hasValidAuth ? (
          <>
            <Shield className="w-4 h-4 text-success" />
            <Badge variant="secondary" className="text-success">Authenticated</Badge>
            {isExpiringSoon && (
              <AlertTriangle className="w-4 h-4 text-warning" />
            )}
          </>
        ) : hasGuestSession ? (
          <>
            <User className="w-4 h-4 text-primary" />
            <Badge variant="outline" className="border-primary/20 text-primary">Guest Session</Badge>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <Badge variant="destructive">Not Authenticated</Badge>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Authentication Status</span>
            {hasValidAuth ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                Authenticated
              </Badge>
            ) : hasGuestSession ? (
              <Badge variant="outline" className="border-primary/20 text-primary">
                Guest Session
              </Badge>
            ) : (
              <Badge variant="destructive">
                Not Authenticated
              </Badge>
            )}
          </div>

          {hasValidAuth && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>Email: {user?.email}</div>
              {sessionExpiry && (
                <div className={isExpiringSoon ? 'text-warning' : ''}>
                  Session expires: {sessionExpiry.toLocaleString()}
                  {isExpiringSoon && ' (expiring soon)'}
                </div>
              )}
            </div>
          )}

          {hasGuestSession && (
            <div className="text-xs text-muted-foreground">
              Guest ID: {guestSession.sessionId.substring(0, 12)}...
            </div>
          )}

          {!hasValidAuth && !hasGuestSession && (
            <div className="text-xs text-destructive">
              Please log in or continue as guest to proceed
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};