import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useCommunicationEvents } from '@/hooks/useCommunicationEvents';
import { format, formatDistanceToNow } from 'date-fns';

interface CommunicationLogProps {
  orderId: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'sent':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
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
    default:
      return 'bg-gray-500';
  }
};

const getEventTypeIcon = (eventType: string) => {
  if (eventType.includes('email') || eventType.includes('mail')) {
    return <Mail className="h-4 w-4" />;
  }
  if (eventType.includes('sms') || eventType.includes('phone')) {
    return <Phone className="h-4 w-4" />;
  }
  return <MessageSquare className="h-4 w-4" />;
};

const getEventTypeLabel = (eventType: string) => {
  const labels: Record<string, string> = {
    'order_confirmed': 'Order Confirmed',
    'order_preparing': 'Order Preparing',
    'order_ready': 'Order Ready',
    'order_out_for_delivery': 'Out for Delivery',
    'order_delivered': 'Order Delivered',
    'order_cancelled': 'Order Cancelled',
    'manual_email': 'Manual Email',
    'manual_sms': 'Manual SMS',
    'payment_confirmed': 'Payment Confirmed',
    'customer_welcome': 'Welcome Message'
  };
  
  return labels[eventType] || eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const CommunicationLog: React.FC<CommunicationLogProps> = ({ orderId }) => {
  const { data: events, isLoading, error } = useCommunicationEvents(orderId);

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
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Communication Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-5 w-5 mr-2" />
            Failed to load communication history
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communication Log
          {events && events.length > 0 && (
            <Badge variant="secondary">{events.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!events || events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No communication events yet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0 mt-1">
                    {getEventTypeIcon(event.event_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">
                        {getEventTypeLabel(event.event_type)}
                      </p>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(event.status)}
                        <Badge 
                          variant="secondary" 
                          className={`${getStatusColor(event.status)} text-white text-xs`}
                        >
                          {event.status}
                        </Badge>
                      </div>
                    </div>
                    
                    {event.recipient_email && (
                      <p className="text-xs text-muted-foreground mb-1">
                        To: {event.recipient_email}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {format(new Date(event.created_at), 'MMM dd, yyyy HH:mm')}
                      </span>
                      <span>
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {event.sent_at && (
                      <p className="text-xs text-green-600 mt-1">
                        Delivered: {format(new Date(event.sent_at), 'MMM dd, HH:mm')}
                      </p>
                    )}
                    
                    {event.error_message && (
                      <p className="text-xs text-red-600 mt-1">
                        Error: {event.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};