import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Mail, Settings, Database, Zap } from 'lucide-react';
import { useSMTPSettings } from '@/hooks/useSMTPSettings';

export const EmailSystemStatus = () => {
  const { settings, isLoading } = useSMTPSettings();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span>Loading email system status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConfigured = settings && settings.use_smtp && settings.smtp_host && settings.smtp_user && settings.sender_email;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Native SMTP Email System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">System Status</span>
          <Badge variant={isConfigured ? "default" : "destructive"} className="gap-1">
            {isConfigured ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Active
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                Needs Configuration
              </>
            )}
          </Badge>
        </div>

        {isConfigured && (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>SMTP Host: {settings.smtp_host}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>Sender: {settings.sender_email}</span>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2">Active Email Flows</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Welcome Emails</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Purchase Receipts</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Admin Notifications</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Order Ready Alerts</span>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-medium">Production Ready</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All email communications use your configured SMTP settings as the single source of truth.
              </p>
            </div>
          </>
        )}

        {!isConfigured && (
          <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Configuration Required</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configure SMTP settings in Communication Settings to enable native email system.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};