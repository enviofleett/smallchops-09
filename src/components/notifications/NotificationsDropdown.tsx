import React from 'react';
import { Bell, Package, CheckCircle, X, Clock, AlertCircle } from 'lucide-react';
import { useOrderNotifications, OrderNotification } from '@/hooks/useOrderNotifications';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'confirmed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'cancelled':
      return <X className="h-4 w-4 text-red-500" />;
    case 'delivered':
      return <Package className="h-4 w-4 text-blue-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-orange-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'cancelled':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'delivered':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'pending':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

function NotificationItem({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: OrderNotification; 
  onMarkAsRead: (id: string) => void;
}) {
  return (
    <div 
      className={`p-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
        !notification.read ? 'bg-primary/5 border-l-4 border-l-primary' : ''
      }`}
      onClick={() => onMarkAsRead(notification.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-0.5">
            {notification.type === 'new_order' ? (
              <Package className="h-4 w-4 text-primary" />
            ) : (
              getStatusIcon(notification.newStatus || '')
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
              {notification.message}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
              </span>
              {notification.newStatus && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getStatusColor(notification.newStatus)}`}
                >
                  {notification.newStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
        )}
      </div>
    </div>
  );
}

export function NotificationsDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAllNotifications } = useOrderNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4 md:h-5 md:w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 md:h-5 md:w-5 p-0 flex items-center justify-center text-xs min-w-4 md:min-w-5"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-80 md:w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 pb-2">
          <DropdownMenuLabel className="text-base font-semibold p-0">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {unreadCount} new
              </Badge>
            )}
          </DropdownMenuLabel>
          
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-xs h-6 px-2"
                >
                  Mark all read
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearAllNotifications}
                className="text-xs h-6 px-2 text-muted-foreground"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs">You'll see order updates here</p>
            </div>
          ) : (
            <div className="max-h-80">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}