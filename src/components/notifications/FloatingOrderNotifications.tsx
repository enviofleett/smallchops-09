import { useNotifications } from "@/context/NotificationContext";
import { X, Package, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { OrderDetailsModal } from "@/components/admin/OrderDetailsModal";
import { useOrderDetails } from "@/hooks/useOrderDetails";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";

export const FloatingOrderNotifications = () => {
  const { activeFloatingNotifications, removeFloatingNotification } = useNotifications();
  const { isAdmin, isLoading: authLoading } = useUnifiedAuth();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    const stored = sessionStorage.getItem('dismissed-notifications');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch order details when an order is selected
  const { order: selectedOrder } = useOrderDetails(selectedOrderId || '');

  // Only show to admin users
  if (authLoading || !isAdmin) return null;

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
    setSelectedOrderId(orderId);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedOrderId(null);
  };

  if (visibleNotifications.length === 0) return null;

  return (
    <>
      <div 
        className="fixed top-16 right-2 sm:right-4 z-[9999] space-y-2 w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:max-w-sm"
        role="region"
        aria-label="Order notifications"
        aria-live="polite"
      >
        {visibleNotifications.map((notification, index) => (
          <div
            key={notification.id}
            className="bg-card border-2 border-primary/20 rounded-lg shadow-xl p-3 sm:p-4 cursor-pointer hover:scale-[1.02] hover:shadow-2xl transition-all duration-200 animate-in slide-in-from-right-5"
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
            <div className="flex items-start gap-2 sm:gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate">
                    {notification.title}
                  </h3>
                  <button
                    onClick={(e) => handleClose(notification.id, e)}
                    className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors no-print"
                    aria-label="Close notification"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                  {notification.message}
                </p>

                {/* Order Details */}
                {notification.data && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3 sm:gap-4">
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
                      <span className="truncate">
                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />
      )}
    </>
  );
};
