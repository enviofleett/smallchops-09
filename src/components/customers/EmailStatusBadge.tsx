import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EmailStatusBadgeProps {
  status: 'sent' | 'failed' | 'pending' | 'bounced' | 'none';
  sentAt?: string;
  lastAttempt?: string;
}

export const EmailStatusBadge = ({ status, sentAt, lastAttempt }: EmailStatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'sent':
        return {
          icon: CheckCircle,
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 border-green-200',
          text: 'Email Sent',
          details: sentAt ? `Sent: ${new Date(sentAt).toLocaleDateString()}` : undefined
        };
      case 'failed':
        return {
          icon: XCircle,
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 border-red-200',
          text: 'Email Failed',
          details: lastAttempt ? `Last attempt: ${new Date(lastAttempt).toLocaleDateString()}` : undefined
        };
      case 'pending':
        return {
          icon: Clock,
          variant: 'secondary' as const,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          text: 'Email Pending',
          details: 'In queue'
        };
      case 'bounced':
        return {
          icon: AlertTriangle,
          variant: 'destructive' as const,
          className: 'bg-orange-100 text-orange-800 border-orange-200',
          text: 'Email Bounced',
          details: 'Delivery failed'
        };
      case 'none':
      default:
        return {
          icon: Mail,
          variant: 'outline' as const,
          className: 'bg-gray-100 text-gray-600 border-gray-200',
          text: 'No Email',
          details: 'Welcome email not sent'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1">
      <Badge variant={config.variant} className={`${config.className} flex items-center gap-1 text-xs`}>
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
      {config.details && (
        <span className="text-xs text-muted-foreground">{config.details}</span>
      )}
    </div>
  );
};