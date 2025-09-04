import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, Notification, NotificationType } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';

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

const getNotificationStyle = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-200 text-green-900';
    case 'error':
      return 'bg-red-50 border-red-200 text-red-900';
    case 'warning':
      return 'bg-orange-50 border-orange-200 text-orange-900';
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-900';
    case 'order':
      return 'bg-purple-50 border-purple-200 text-purple-900';
    default:
      return 'bg-white border-gray-200 text-gray-900';
  }
};

export const NotificationPreview: React.FC = () => {
  const { state, hidePreview, markAsRead } = useNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  const notification = state.currentPreview;
  const shouldShow = state.isPreviewVisible && notification;

  useEffect(() => {
    if (shouldShow) {
      setIsVisible(true);
      setProgress(100);
      
      // Animate progress bar
      const duration = notification?.duration || 5000;
      const interval = 50;
      const steps = duration / interval;
      const decrement = 100 / steps;
      
      let currentProgress = 100;
      const progressInterval = setInterval(() => {
        currentProgress -= decrement;
        if (currentProgress <= 0) {
          clearInterval(progressInterval);
          handleClose();
        } else {
          setProgress(currentProgress);
        }
      }, interval);

      return () => clearInterval(progressInterval);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow, notification?.duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      hidePreview();
    }, 300);
  };

  const handleClick = () => {
    if (notification) {
      markAsRead(notification.id);
      if (notification.action) {
        notification.action.onClick();
      }
      handleClose();
    }
  };

  if (!notification) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      {isVisible && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden animate-fade-in"
          onClick={handleClose}
        />
      )}
      
      {/* Notification Preview */}
      <div
        className={cn(
          'fixed top-4 right-4 w-80 max-w-[calc(100vw-2rem)] z-50 transition-all duration-300 ease-out',
          'border rounded-lg shadow-lg backdrop-blur-sm',
          getNotificationStyle(notification.type),
          isVisible 
            ? 'translate-x-0 opacity-100 scale-100' 
            : 'translate-x-full opacity-0 scale-95',
          'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
        )}
        onClick={handleClick}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-black/10 rounded-t-lg overflow-hidden">
          <div
            className="h-full bg-black/20 transition-all duration-50 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="text-lg flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm leading-tight pr-2">
                  {notification.title}
                </h4>
                
                <div className="flex items-center gap-1 flex-shrink-0">
                  {notification.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        notification.action!.onClick();
                        handleClose();
                      }}
                      title={notification.action.label}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                    }}
                    title="Close"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {notification.message && (
                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                  {notification.message}
                </p>
              )}

              {notification.action && (
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      notification.action!.onClick();
                      handleClose();
                    }}
                    className="text-xs h-6 px-2 bg-white/50 hover:bg-white/70"
                  >
                    {notification.action.label}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Click hint */}
        <div className="absolute bottom-1 right-2 text-xs opacity-50">
          Click to dismiss
        </div>
      </div>
    </>
  );
};