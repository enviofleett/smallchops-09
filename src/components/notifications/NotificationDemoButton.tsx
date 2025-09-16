import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useNotificationDemo } from '@/hooks/useNotificationDemo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Demo component for testing notifications
 * This can be temporarily added to any page for testing
 */
export const NotificationDemoButton: React.FC = () => {
  const {
    showSuccessNotification,
    showOrderNotification,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification,
    showOrderStatusUpdate,
    showPromotionNotification,
  } = useNotificationDemo();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="fixed bottom-4 left-4 z-50">
          <Bell className="h-4 w-4 mr-2" />
          Test Notifications
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Test Notification Types</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={showSuccessNotification}>
          ✅ Success Notification
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={showOrderNotification}>
          📦 Order Notification
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={showErrorNotification}>
          ❌ Error Notification
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={showWarningNotification}>
          ⚠️ Warning Notification
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={showInfoNotification}>
          ℹ️ Info Notification
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Real-World Examples</DropdownMenuLabel>
        
        <DropdownMenuItem onClick={() => showOrderStatusUpdate('12345', 'confirmed')}>
          Order Confirmed
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => showOrderStatusUpdate('12345', 'ready')}>
          Order Ready
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => showOrderStatusUpdate('12345', 'delivered')}>
          Order Delivered
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => showPromotionNotification({
          title: '🎉 Weekend Special!',
          discount: '25%'
        })}>
          Promotion Alert
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};