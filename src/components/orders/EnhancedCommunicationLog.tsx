import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Send,
  Phone
} from 'lucide-react';
import { format } from 'date-fns';

interface CommunicationEvent {
  id: string;
  event_type: string;
  recipient_email?: string;
  template_key?: string;
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';
  created_at: string;
  sent_at?: string;
  processed_at?: string;
  retry_count: number;
  error_message?: string;
  delivery_status?: string;
  priority?: string;
  channel?: string;
  variables?: any;
  template_variables?: any;
}

interface EnhancedCommunicationLogProps {
  events: CommunicationEvent[];
  isLoading?: boolean;
}

export const EnhancedCommunicationLog: React.FC<EnhancedCommunicationLogProps> = ({ 
  events, 
  isLoading = false 
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'processing':
        return 'bg-blue-500';
      case 'queued':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-muted';
    }
  };

  const getChannelIcon = (channel?: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTemplateKey = (templateKey?: string) => {
    if (!templateKey) return 'No Template';
    return templateKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Communication Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Communication Log (0)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No communication events found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communication Log ({events.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="border border-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getChannelIcon(event.channel)}
                  <div>
                    <h4 className="font-medium text-sm">
                      {formatEventType(event.event_type)}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {formatTemplateKey(event.template_key)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {event.priority === 'high' && (
                    <Badge variant="destructive" className="text-xs">
                      High Priority
                    </Badge>
                  )}
                  <Badge 
                    variant="secondary" 
                    className={`${getStatusColor(event.status)} text-white`}
                  >
                    <span className="flex items-center gap-1">
                      {getStatusIcon(event.status)}
                      {event.status}
                    </span>
                  </Badge>
                </div>
              </div>

              {/* Recipient & Timing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <p className="text-muted-foreground">Recipient</p>
                  <p className="font-medium">{event.recipient_email || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {format(new Date(event.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* Delivery Details */}
              {(event.sent_at || event.processed_at || event.retry_count > 0) && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm p-3 bg-muted/50 rounded-md mb-3">
                  {event.sent_at && (
                    <div>
                      <p className="text-muted-foreground text-xs">Sent At</p>
                      <p className="font-medium">
                        {format(new Date(event.sent_at), 'HH:mm:ss')}
                      </p>
                    </div>
                  )}
                  {event.processed_at && (
                    <div>
                      <p className="text-muted-foreground text-xs">Processed At</p>
                      <p className="font-medium">
                        {format(new Date(event.processed_at), 'HH:mm:ss')}
                      </p>
                    </div>
                  )}
                  {event.retry_count > 0 && (
                    <div>
                      <p className="text-muted-foreground text-xs">Retry Count</p>
                      <p className="font-medium text-orange-600">
                        {event.retry_count} attempts
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {event.error_message && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-300">
                    <strong>Error:</strong> {event.error_message}
                  </p>
                </div>
              )}

              {/* Variables (for debugging) */}
              {(event.variables || event.template_variables) && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    View Variables
                  </summary>
                  <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(event.variables || event.template_variables, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};