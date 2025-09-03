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
            <div className="bg-muted/30 p-3 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Configuration Source</span>
                <Badge variant="outline" className="text-xs">
                  <Database className="h-3 w-3 mr-1" />
                  Database (Fallback)
                </Badge>
              </div>
              
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
              
              <div className="text-xs text-amber-600 p-2 bg-amber-50 rounded border border-amber-200">
                <strong>⚠️ Development Mode:</strong> Using database SMTP settings. For production, 
                configure SMTP credentials in Function Secrets for better security and performance.
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
                  <span>Order Confirmations</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Status Updates</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Admin Notifications</span>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-medium">Branded Fallback System Active</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Missing templates use curated branded fallbacks from the Branded Fallback Library, ensuring consistent messaging with business branding.
              </p>
            </div>
          </>
        )}

        {!isConfigured && (
          <div className="space-y-3">
            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Configuration Required</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Configure SMTP settings via Function Secrets (production) or Communication Settings (development).
              </p>
            </div>
            
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded border">
              <strong>Production Setup:</strong> Add SMTP credentials to Function Secrets in your Supabase dashboard 
              for secure, production-ready email delivery with better performance and monitoring.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};