import React from 'react';
import { AlertCircle, Mail, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmailStatusGuideProps {
  className?: string;
}

export const EmailStatusGuide: React.FC<EmailStatusGuideProps> = ({ className }) => {
  const emailStatuses = [
    {
      status: 'ready',
      icon: '📦',
      title: 'Ready for Pickup',
      description: 'Customer notified order is ready for collection',
    },
    {
      status: 'out_for_delivery',
      icon: '🚚',
      title: 'Out for Delivery',
      description: 'Customer informed order is on the way',
    },
    {
      status: 'delivered',
      icon: '✅',
      title: 'Delivered',
      description: 'Delivery confirmation sent to customer',
    },
    {
      status: 'cancelled',
      icon: '❌',
      title: 'Cancelled',
      description: 'Cancellation notice with refund information',
    },
    {
      status: 'completed',
      icon: '🎉',
      title: 'Completed',
      description: 'Thank you message with feedback request',
    },
    {
      status: 'returned',
      icon: '📦',
      title: 'Returned',
      description: 'Return processed with refund timeline',
    },
  ];

  return (
    <div className={className}>
      <Alert className="mb-4">
        <Mail className="h-4 w-4" />
        <AlertDescription>
          <strong>Email Automation Active</strong>
          <br />
          Customers automatically receive professional email notifications when orders change to the following statuses:
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {emailStatuses.map((item) => (
          <div key={item.status} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
            <span className="text-xl">{item.icon}</span>
            <div className="flex-1">
              <div className="font-medium text-sm text-foreground">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </div>
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm font-medium">
          <AlertCircle className="h-4 w-4" />
          Production Ready Features
        </div>
        <ul className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-1">
          <li>• Email templates with your business branding</li>
          <li>• Automatic variable substitution (name, order number, etc.)</li>
          <li>• Delivery confirmation and tracking info</li>
          <li>• Professional HTML and plain text versions</li>
          <li>• Error handling and retry mechanisms</li>
        </ul>
      </div>
    </div>
  );
};