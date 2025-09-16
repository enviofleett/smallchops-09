import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { useNotificationSoundEffect } from '@/hooks/useNotificationSound';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'order';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoClose?: boolean;
  duration?: number;
  sound?: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isPreviewVisible: boolean;
  currentPreview?: Notification;
}

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'SHOW_PREVIEW'; payload: Notification }
  | { type: 'HIDE_PREVIEW' }
  | { type: 'CLEAR_ALL' };

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isPreviewVisible: false,
};

const notificationReducer = (
  state: NotificationState,
  action: NotificationAction
): NotificationState => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      const newNotifications = [action.payload, ...state.notifications];
      return {
        ...state,
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length,
      };

    case 'REMOVE_NOTIFICATION':
      const filteredNotifications = state.notifications.filter(
        n => n.id !== action.payload
      );
      return {
        ...state,
        notifications: filteredNotifications,
        unreadCount: filteredNotifications.filter(n => !n.read).length,
      };

    case 'MARK_AS_READ':
      const updatedNotifications = state.notifications.map(n =>
        n.id === action.payload ? { ...n, read: true } : n
      );
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: updatedNotifications.filter(n => !n.read).length,
      };

    case 'MARK_ALL_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      };

    case 'SHOW_PREVIEW':
      return {
        ...state,
        isPreviewVisible: true,
        currentPreview: action.payload,
      };

    case 'HIDE_PREVIEW':
      return {
        ...state,
        isPreviewVisible: false,
        currentPreview: undefined,
      };

    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: [],
        unreadCount: 0,
      };

    default:
      return state;
  }
};

interface NotificationContextType {
  state: NotificationState;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  showPreview: (notification: Notification) => void;
  hidePreview: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const playNotificationSound = useNotificationSoundEffect({ enabled: true, volume: 0.7 });

  const addNotification = useCallback((
    notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => {
    const notification: Notification = {
      ...notificationData,
      id: Date.now().toString() + Math.random().toString(36),
      timestamp: new Date(),
      read: false,
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });

    // Play notification sound
    playNotificationSound(notification.type, true);

    // Show preview for new notifications
    dispatch({ type: 'SHOW_PREVIEW', payload: notification });

    // Auto-hide preview after duration
    setTimeout(() => {
      dispatch({ type: 'HIDE_PREVIEW' });
    }, notification.duration || 5000);

    // Auto-remove if specified
    if (notification.autoClose !== false) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
      }, notification.duration || 10000);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_AS_READ', payload: id });
  }, []);

  const markAllAsRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_AS_READ' });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const showPreview = useCallback((notification: Notification) => {
    dispatch({ type: 'SHOW_PREVIEW', payload: notification });
  }, []);

  const hidePreview = useCallback(() => {
    dispatch({ type: 'HIDE_PREVIEW' });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        state,
        addNotification,
        removeNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        showPreview,
        hidePreview,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};