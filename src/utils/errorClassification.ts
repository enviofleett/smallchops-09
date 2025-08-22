/**
 * Enhanced error classification system for better user experience
 * Categorizes errors and provides appropriate user-friendly messages and actions
 */

export interface ClassifiedError {
  type: 'network' | 'auth' | 'server' | 'client' | 'timeout' | 'permission' | 'rate_limit' | 'unknown';
  category: 'connectivity' | 'authentication' | 'server_error' | 'client_error' | 'permission' | 'throttling';
  userMessage: string;
  technicalMessage: string;
  actionable: boolean;
  retryable: boolean;
  suggestedActions: string[];
  errorId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function classifyError(error: any): ClassifiedError {
  const errorId = generateErrorId();
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const statusCode = error?.status || error?.statusCode || 0;

  // Network connectivity errors
  if (
    errorMessage.includes('fetch') ||
    errorMessage.includes('Network Error') ||
    errorMessage.includes('ERR_NETWORK') ||
    errorMessage.includes('ERR_INTERNET_DISCONNECTED') ||
    !navigator.onLine
  ) {
    return {
      type: 'network',
      category: 'connectivity',
      userMessage: 'Connection problem detected. Please check your internet connection.',
      technicalMessage: errorMessage,
      actionable: true,
      retryable: true,
      suggestedActions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Switch to a different network if available'
      ],
      errorId,
      severity: 'high'
    };
  }

  // Timeout errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('TIMEOUT') ||
    errorMessage.includes('Request timed out')
  ) {
    return {
      type: 'timeout',
      category: 'connectivity',
      userMessage: 'Request timed out. This might be due to a slow connection or server issue.',
      technicalMessage: errorMessage,
      actionable: true,
      retryable: true,
      suggestedActions: [
        'Check your connection speed',
        'Try again in a moment',
        'Contact support if the problem persists'
      ],
      errorId,
      severity: 'medium'
    };
  }

  // Authentication errors
  if (
    statusCode === 401 ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('invalid token')
  ) {
    return {
      type: 'auth',
      category: 'authentication',
      userMessage: 'Authentication required. Please log in again.',
      technicalMessage: errorMessage,
      actionable: true,
      retryable: false,
      suggestedActions: [
        'Log out and log back in',
        'Clear your browser cache',
        'Contact support if you continue having issues'
      ],
      errorId,
      severity: 'high'
    };
  }

  // Permission/authorization errors
  if (
    statusCode === 403 ||
    errorMessage.includes('forbidden') ||
    errorMessage.includes('access denied') ||
    errorMessage.includes('insufficient permissions')
  ) {
    return {
      type: 'permission',
      category: 'permission',
      userMessage: 'Access denied. You may not have permission to view this data.',
      technicalMessage: errorMessage,
      actionable: true,
      retryable: false,
      suggestedActions: [
        'Contact your administrator for access',
        'Verify your account permissions',
        'Try logging out and back in'
      ],
      errorId,
      severity: 'medium'
    };
  }

  // Rate limiting errors
  if (
    statusCode === 429 ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests')
  ) {
    return {
      type: 'rate_limit',
      category: 'throttling',
      userMessage: 'Too many requests. Please wait a moment before trying again.',
      technicalMessage: errorMessage,
      actionable: true,
      retryable: true,
      suggestedActions: [
        'Wait a few seconds and try again',
        'Avoid rapid successive requests',
        'Contact support if this happens frequently'
      ],
      errorId,
      severity: 'low'
    };
  }

  // Server errors (5xx)
  if (statusCode >= 500 && statusCode < 600) {
    return {
      type: 'server',
      category: 'server_error',
      userMessage: 'Server error occurred. Our team has been notified.',
      technicalMessage: errorMessage,
      actionable: true,
      retryable: true,
      suggestedActions: [
        'Try again in a few minutes',
        'Check our status page for updates',
        'Contact support with error ID if problem persists'
      ],
      errorId,
      severity: 'high'
    };
  }

  // Client errors (4xx)
  if (statusCode >= 400 && statusCode < 500) {
    return {
      type: 'client',
      category: 'client_error',
      userMessage: 'Request error. Please try again or contact support.',
      technicalMessage: errorMessage,
      actionable: true,
      retryable: false,
      suggestedActions: [
        'Refresh the page and try again',
        'Clear your browser cache',
        'Contact support with error ID'
      ],
      errorId,
      severity: 'medium'
    };
  }

  // Unknown/generic errors
  return {
    type: 'unknown',
    category: 'client_error',
    userMessage: 'An unexpected error occurred. Please try again.',
    technicalMessage: errorMessage,
    actionable: true,
    retryable: true,
    suggestedActions: [
      'Refresh the page',
      'Try again in a moment',
      'Contact support if the problem persists'
    ],
    errorId,
    severity: 'medium'
  };
}

export function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ERR_${timestamp}_${random}`.toUpperCase();
}

export function logError(classifiedError: ClassifiedError, context?: any): void {
  const logData = {
    errorId: classifiedError.errorId,
    type: classifiedError.type,
    category: classifiedError.category,
    severity: classifiedError.severity,
    technicalMessage: classifiedError.technicalMessage,
    userMessage: classifiedError.userMessage,
    context: context || {},
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 ${classifiedError.severity.toUpperCase()} Error [${classifiedError.errorId}]`);
    console.error('Type:', classifiedError.type);
    console.error('Category:', classifiedError.category);
    console.error('Message:', classifiedError.technicalMessage);
    console.error('Context:', context);
    console.groupEnd();
  }

  // In production, you would send this to your logging service
  if (process.env.NODE_ENV === 'production') {
    try {
      // Example: Send to external logging service
      // logToService(logData);
      console.error('[Error ID: ' + classifiedError.errorId + ']', logData);
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }
}

// Utility function to determine if an error should trigger a retry
export function shouldRetry(classifiedError: ClassifiedError, retryCount: number, maxRetries: number = 3): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }

  if (!classifiedError.retryable) {
    return false;
  }

  // Don't retry authentication or permission errors
  if (classifiedError.type === 'auth' || classifiedError.type === 'permission') {
    return false;
  }

  // Retry network, timeout, and server errors
  return ['network', 'timeout', 'server', 'rate_limit'].includes(classifiedError.type);
}

// Calculate retry delay with exponential backoff and jitter
export function calculateRetryDelay(retryCount: number, baseDelay: number = 1000): number {
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}