import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Zap, Info, CheckCircle, XCircle } from 'lucide-react';

export interface AdminToastMessage {
  title: string;
  description: React.ReactNode;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
  action?: React.ReactNode;
}

interface AdminToastOptions {
  orderId?: string;
  orderNumber?: string;
  onRetry?: () => void;
  onBypassCache?: () => void;
  onRefreshPage?: () => void;
}

/**
 * Provides friendly, actionable toast messages for admin operations
 */
export const adminToastMessages = {
  // Cache and 409 conflict messages
  cacheConflict: (options: AdminToastOptions = {}): AdminToastMessage => ({
    title: "⚡ Cache Conflict Detected",
    description: (
      <div className="space-y-2">
        <p className="text-sm">
          The system cache is preventing your update{options.orderNumber ? ` to order ${options.orderNumber}` : ''}.
        </p>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <p className="font-medium mb-1">💡 What you can do:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Click "Bypass Cache" to force the update</li>
            <li>Or refresh the page and try again</li>
          </ul>
        </div>
      </div>
    ),
    variant: 'destructive',
    duration: 0, // Don't auto-dismiss
    action: options.onBypassCache ? (
      <Button size="sm" variant="outline" onClick={options.onBypassCache}>
        <Zap className="w-3 h-3 mr-1" />
        Bypass Cache
      </Button>
    ) : undefined
  }),

  // Concurrent update messages
  concurrentUpdate: (options: AdminToastOptions = {}): AdminToastMessage => ({
    title: "🔒 Another Admin is Active",
    description: (
      <div className="space-y-2">
        <p className="text-sm">
          Another administrator is currently updating{options.orderNumber ? ` order ${options.orderNumber}` : ' this order'}.
        </p>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <p className="font-medium mb-1">💡 What you can do:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Wait a few seconds and try again</li>
            <li>Check if the order is locked by another admin</li>
            <li>Refresh the page to see latest updates</li>
          </ul>
        </div>
      </div>
    ),
    variant: 'default',
    duration: 8000,
    action: options.onRetry ? (
      <Button size="sm" variant="outline" onClick={options.onRetry}>
        <RefreshCw className="w-3 h-3 mr-1" />
        Try Again
      </Button>
    ) : undefined
  }),

  // Network error messages
  networkError: (options: AdminToastOptions = {}): AdminToastMessage => ({
    title: "🌐 Connection Issue",
    description: (
      <div className="space-y-2">
        <p className="text-sm">
          Unable to connect to the server. Your internet connection might be unstable.
        </p>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <p className="font-medium mb-1">💡 What you can do:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Check your internet connection</li>
            <li>Try refreshing the page</li>
            <li>Wait a moment and retry the operation</li>
          </ul>
        </div>
      </div>
    ),
    variant: 'destructive',
    duration: 10000,
    action: options.onRetry ? (
      <Button size="sm" variant="outline" onClick={options.onRetry}>
        <RefreshCw className="w-3 h-3 mr-1" />
        Retry
      </Button>
    ) : undefined
  }),

  // Authentication error messages
  authenticationError: (options: AdminToastOptions = {}): AdminToastMessage => ({
    title: "🔐 Session Expired",
    description: (
      <div className="space-y-2">
        <p className="text-sm">
          Your admin session has expired for security reasons.
        </p>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <p className="font-medium mb-1">💡 What you can do:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Refresh the page to log in again</li>
            <li>Make sure you're signed in as an admin</li>
            <li>Clear your browser cache if issues persist</li>
          </ul>
        </div>
      </div>
    ),
    variant: 'destructive',
    duration: 0, // Don't auto-dismiss
    action: options.onRefreshPage ? (
      <Button size="sm" variant="outline" onClick={options.onRefreshPage}>
        <RefreshCw className="w-3 h-3 mr-1" />
        Refresh Page
      </Button>
    ) : (
      <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
        <RefreshCw className="w-3 h-3 mr-1" />
        Refresh Page
      </Button>
    )
  }),

  // Success messages
  orderUpdated: (options: AdminToastOptions = {}): AdminToastMessage => ({
    title: "✅ Order Updated Successfully",
    description: (
      <div className="space-y-1">
        <p className="text-sm">
          {options.orderNumber ? `Order ${options.orderNumber}` : 'Order'} has been updated successfully.
        </p>
        <p className="text-xs text-muted-foreground">
          Customer will be notified automatically if applicable.
        </p>
      </div>
    ),
    variant: 'success',
    duration: 4000
  }),

  cacheBypassSuccess: (options: AdminToastOptions = {}): AdminToastMessage => ({
    title: "⚡ Cache Bypassed Successfully",
    description: (
      <div className="space-y-1">
        <p className="text-sm">
          Cache was cleared and {options.orderNumber ? `order ${options.orderNumber}` : 'order'} was updated successfully.
        </p>
        <p className="text-xs text-muted-foreground">
          The system is now working normally.
        </p>
      </div>
    ),
    variant: 'success',
    duration: 5000
  }),

  // Rate limit messages
  rateLimitError: (options: AdminToastOptions = {}): AdminToastMessage => ({
    title: "⏰ Too Many Requests",
    description: (
      <div className="space-y-2">
        <p className="text-sm">
          You've made too many requests in a short time. Please wait before trying again.
        </p>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <p className="font-medium mb-1">💡 What you can do:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Wait 30 seconds before retrying</li>
            <li>Avoid rapid-fire clicking on buttons</li>
            <li>Use the bypass function if urgent</li>
          </ul>
        </div>
      </div>
    ),
    variant: 'default',
    duration: 8000
  }),

  // Generic server error
  serverError: (options: AdminToastOptions = {}): AdminToastMessage => ({
    title: "🔧 Server Error",
    description: (
      <div className="space-y-2">
        <p className="text-sm">
          Something went wrong on our end. This is usually temporary.
        </p>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <p className="font-medium mb-1">💡 What you can do:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Try the operation again in a few seconds</li>
            <li>Check if the issue persists</li>
            <li>Contact support if it keeps happening</li>
          </ul>
        </div>
      </div>
    ),
    variant: 'destructive',
    duration: 8000,
    action: options.onRetry ? (
      <Button size="sm" variant="outline" onClick={options.onRetry}>
        <RefreshCw className="w-3 h-3 mr-1" />
        Try Again
      </Button>
    ) : undefined
  }),

  // Helper function to parse error and get appropriate message
  getErrorMessage: (error: any, options: AdminToastOptions = {}): AdminToastMessage => {
    const errorMessage = error?.message || String(error || '');
    const lowerError = errorMessage.toLowerCase();

    // Cache conflicts and 409 errors
    if (lowerError.includes('409') || 
        lowerError.includes('cache') || 
        lowerError.includes('concurrent_update_in_progress') ||
        lowerError.includes('conflict')) {
      return adminToastMessages.cacheConflict(options);
    }

    // Network errors
    if (lowerError.includes('network') || 
        lowerError.includes('fetch') ||
        lowerError.includes('connection') ||
        lowerError.includes('timeout')) {
      return adminToastMessages.networkError(options);
    }

    // Authentication errors
    if (lowerError.includes('401') || 
        lowerError.includes('unauthorized') ||
        lowerError.includes('session') ||
        lowerError.includes('authentication')) {
      return adminToastMessages.authenticationError(options);
    }

    // Rate limit errors
    if (lowerError.includes('rate limit') || 
        lowerError.includes('too many requests') ||
        lowerError.includes('limit exceeded')) {
      return adminToastMessages.rateLimitError(options);
    }

    // Concurrent update
    if (lowerError.includes('another admin') ||
        lowerError.includes('locked') ||
        lowerError.includes('concurrent')) {
      return adminToastMessages.concurrentUpdate(options);
    }

    // Default server error
    return adminToastMessages.serverError(options);
  }
};

// Convenience function to show admin toast
export const showAdminToast = (
  toastFn: Function,
  messageType: keyof typeof adminToastMessages,
  options: AdminToastOptions = {}
) => {
  if (messageType === 'getErrorMessage') {
    throw new Error('Use showAdminErrorToast for error messages');
  }
  
  const message = adminToastMessages[messageType as keyof Omit<typeof adminToastMessages, 'getErrorMessage'>](options);
  
  // Extract properties for toast function call
  const { title, description, variant, duration, action } = message;
  
  return toastFn(title, {
    description,
    variant,
    duration,
    action
  });
};

// Convenience function for error toasts
export const showAdminErrorToast = (
  toastFn: Function,
  error: any,
  options: AdminToastOptions = {}
) => {
  const message = adminToastMessages.getErrorMessage(error, options);
  
  // Extract properties for toast function call
  const { title, description, variant, duration, action } = message;
  
  return toastFn(title, {
    description,
    variant,
    duration,
    action
  });
};