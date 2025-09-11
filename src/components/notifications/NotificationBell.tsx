import React, { useState } from 'react';
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, Notification, NotificationType } from '@/context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNotificationSound } from '@/hooks/useNotificationSound';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return '✅';
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    case 'order':
      return '📦';
    default:
      return '🔔';
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'warning':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'info':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'order':
      return 'text-purple-600 bg-purple-50 border-purple-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onRemove,
}) => {
  return (
    <div
      className={cn(
        'p-3 border rounded-lg transition-all',
        notification.read ? 'opacity-70' : 'opacity-100',
        getNotificationColor(notification.type)
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-lg flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-medium text-sm leading-tight">
                {notification.title}
              </h4>
              {notification.message && (
                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                  {notification.message}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMarkAsRead(notification.id)}
                  className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                  title="Mark as read"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(notification.id)}
                className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs opacity-60">
              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            </span>
            
            {notification.action && (
              <Button
                variant="outline"
                size="sm"
                onClick={notification.action.onClick}
                className="text-xs h-6 px-2"
              >
                {notification.action.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotificationBell: React.FC = () => {
  const { state, markAsRead, removeNotification, markAllAsRead, clearAll } = useNotifications();
  const { playSound } = useNotificationSound({ enabled: true, volume: 0.3 });
  const [isOpen, setIsOpen] = useState(false);

  const hasUnread = state.unreadCount > 0;
  const recentNotifications = state.notifications.slice(0, 10);

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleOpenChange = (open: boolean) => {
    if (open && hasUnread) {
      // Play a subtle info sound when opening notifications with unread items
      playSound('info');
    }
    setIsOpen(open);
  };

  const handleClearAll = () => {
    clearAll();
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title={`Notifications (${state.unreadCount} unread)`}
        >
          <Bell className={cn(
            "h-5 w-5 transition-colors",
            hasUnread && "text-primary animate-pulse"
          )} />
          {hasUnread && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 animate-scale-in"
            >
              {state.unreadCount > 99 ? '99+' : state.unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  className="text-xs h-7 px-2"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Read all
                </Button>
              )}
              {state.notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                  title="Clear all"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          
          {hasUnread && (
            <p className="text-xs text-muted-foreground mt-1">
              {state.unreadCount} unread notification{state.unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {recentNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                We'll notify you when something happens!
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {recentNotifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <NotificationItem
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onRemove={removeNotification}
                  />
                  {index < recentNotifications.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {state.notifications.length > 10 && (
          <div className="border-t p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Showing recent 10 of {state.notifications.length} notifications
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};