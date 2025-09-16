import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotificationDemo } from '@/hooks/useNotificationDemo';
import { triggerOrderUpdate, triggerPaymentSuccess, triggerPaymentError, triggerPromotion } from '@/components/notifications/NotificationIntegration';

export const NotificationDemo: React.FC = () => {
  const {
    showSuccessNotification,
    showOrderNotification,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification,
  } = useNotificationDemo();

  const handleGlobalOrderUpdate = () => {
    triggerOrderUpdate('ORD-2024-001', 'delivered', 'Your delicious order has been delivered successfully!');
  };

  const handleGlobalPaymentSuccess = () => {
    triggerPaymentSuccess('ORD-2024-002', 2500);
  };

  const handleGlobalPaymentError = () => {
    triggerPaymentError('Payment declined. Please check your card details and try again.');
  };

  const handleGlobalPromotion = () => {
    triggerPromotion('🎉 Weekend Special!', 'Get 30% off on all items this weekend only!');
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔔 Notification System Demo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">Direct Notifications</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={showSuccessNotification}
              variant="outline"
              size="sm"
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              ✅ Success
            </Button>
            <Button
              onClick={showOrderNotification}
              variant="outline"
              size="sm"
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              📦 Order Update
            </Button>
            <Button
              onClick={showErrorNotification}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              ❌ Error
            </Button>
            <Button
              onClick={showWarningNotification}
              variant="outline"
              size="sm"
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              ⚠️ Warning
            </Button>
            <Button
              onClick={showInfoNotification}
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              ℹ️ Info
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Global Event Triggers</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleGlobalOrderUpdate}
              variant="outline"
              size="sm"
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              📦 Order Delivered
            </Button>
            <Button
              onClick={handleGlobalPaymentSuccess}
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              💳 Payment Success
            </Button>
            <Button
              onClick={handleGlobalPaymentError}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              💳 Payment Error
            </Button>
            <Button
              onClick={handleGlobalPromotion}
              variant="outline"
              size="sm"
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              🎉 Promotion
            </Button>
          </div>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Demo Features:</strong> Each notification includes sound, floating preview with progress bar, 
            action buttons, and unread count in the bell icon. Global triggers simulate real-world events 
            like order updates and payment processing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};