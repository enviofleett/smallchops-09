import { useNotifications } from "@/context/NotificationContext";
import { useNavigate } from "react-router-dom";
import { X, Package, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

export const FloatingOrderNotifications = () => {
  const { activeFloatingNotifications, removeFloatingNotification } = useNotifications();
  const navigate = useNavigate();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    const stored = sessionStorage.getItem('dismissed-notifications');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Filter out dismissed notifications
  const visibleNotifications = activeFloatingNotifications.filter(
    notif => !dismissedIds.has(notif.id)
  );

  // Persist dismissed IDs (max 50 entries)
  useEffect(() => {
    const idsArray = Array.from(dismissedIds).slice(-50);
    sessionStorage.setItem('dismissed-notifications', JSON.stringify(idsArray));
  }, [dismissedIds]);

  const handleClose = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds(prev => new Set([...prev, id]));
    removeFloatingNotification(id);
  };

  const handleNotificationClick = (orderId: string) => {
    navigate(`/admin/orders/${orderId}`);
  };

  if (visibleNotifications.length === 0) return null;

  return (
    <div 
      className="fixed top-16 right-4 z-[9999] space-y-2 max-w-sm w-full"
      role="region"
      aria-label="Order notifications"
      aria-live="polite"
    >
      {visibleNotifications.map((notification, index) => (
        <div
          key={notification.id}
          className="bg-card border-2 border-primary/20 rounded-lg shadow-xl p-4 cursor-pointer hover:scale-[1.02] hover:shadow-2xl transition-all duration-200 animate-in slide-in-from-right-5"
          style={{
            animationDelay: `${index * 50}ms`,
          }}
          onClick={() => handleNotificationClick(notification.data?.orderId)}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleNotificationClick(notification.data?.orderId);
            }
          }}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-foreground text-sm truncate">
                  {notification.title}
                </h3>
                <button
                  onClick={(e) => handleClose(notification.id, e)}
                  className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors no-print"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {notification.message}
              </p>

              {/* Order Details */}
              {notification.data && (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-success">
                      ₦{Number(notification.data.totalAmount || 0).toLocaleString()}
                    </span>
                    {notification.data.itemCount && (
                      <span className="text-muted-foreground">
                        {notification.data.itemCount} {notification.data.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNotificationClick(notification.data?.orderId);
                }}
                className="mt-3 w-full py-1.5 px-3 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                View Order Details
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
