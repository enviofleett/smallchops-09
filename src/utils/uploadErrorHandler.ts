interface UploadError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  suggestions: string[];
}

interface ErrorAnalysis {
  primaryError: UploadError;
  context: {
    fileSize?: number;
    fileType?: string;
    fileName?: string;
    connectionQuality?: 'good' | 'poor' | 'offline';
  };
}

/**
 * Comprehensive error handler for image upload failures
 */
export class UploadErrorHandler {
  private static readonly ERROR_PATTERNS: { [key: string]: UploadError } = {
    NETWORK_TIMEOUT: {
      code: 'NETWORK_TIMEOUT',
      message: 'Request timed out',
      userMessage: 'Upload timed out. Please check your internet connection and try again.',
      retryable: true,
      suggestions: [
        'Check your internet connection',
        'Try uploading a smaller image',
        'Retry in a few moments'
      ]
    },
    NETWORK_ERROR: {
      code: 'NETWORK_ERROR',
      message: 'Network connection failed',
      userMessage: 'Network error occurred. Please check your connection.',
      retryable: true,
      suggestions: [
        'Check your internet connection',
        'Disable any VPN temporarily',
        'Try refreshing the page'
      ]
    },
    FILE_TOO_LARGE: {
      code: 'FILE_TOO_LARGE',
      message: 'File size exceeds limit',
      userMessage: 'Image is too large. Please use an image smaller than 10MB.',
      retryable: false,
      suggestions: [
        'Compress your image using an image editor',
        'Use a different image format (JPEG is usually smaller)',
        'Resize the image to smaller dimensions'
      ]
    },
    INVALID_FILE_TYPE: {
      code: 'INVALID_FILE_TYPE',
      message: 'Unsupported file format',
      userMessage: 'Invalid file type. Please use PNG, JPG, or WebP format.',
      retryable: false,
      suggestions: [
        'Convert your image to PNG, JPG, or WebP format',
        'Use an image editor to save in a supported format',
        'Try a different image file'
      ]
    },
    FILE_CORRUPTED: {
      code: 'FILE_CORRUPTED',
      message: 'File appears to be corrupted',
      userMessage: 'This image file appears to be corrupted or damaged.',
      retryable: false,
      suggestions: [
        'Try opening the image in an image editor and re-saving it',
        'Use a different image file',
        'Download the image again if it came from the internet'
      ]
    },
    PERMISSION_DENIED: {
      code: 'PERMISSION_DENIED',
      message: 'Access denied',
      userMessage: 'You don\'t have permission to upload images.',
      retryable: false,
      suggestions: [
        'Contact an administrator for access',
        'Make sure you\'re logged in with the correct account'
      ]
    },
    RATE_LIMIT_EXCEEDED: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many uploads',
      userMessage: 'You\'ve exceeded the upload limit. Please wait before trying again.',
      retryable: true,
      suggestions: [
        'Wait a few minutes before trying again',
        'Reduce the number of simultaneous uploads'
      ]
    },
    SERVER_ERROR: {
      code: 'SERVER_ERROR',
      message: 'Server encountered an error',
      userMessage: 'A server error occurred. Please try again in a few moments.',
      retryable: true,
      suggestions: [
        'Try again in a few minutes',
        'Contact support if the problem persists'
      ]
    },
    STORAGE_FULL: {
      code: 'STORAGE_FULL',
      message: 'Storage quota exceeded',
      userMessage: 'Storage space is full. Please contact an administrator.',
      retryable: false,
      suggestions: [
        'Contact an administrator to increase storage space',
        'Delete some unused images first'
      ]
    },
    CSP_VIOLATION: {
      code: 'CSP_VIOLATION',
      message: 'Content Security Policy violation',
      userMessage: 'Security settings are blocking the upload. Please refresh the page.',
      retryable: true,
      suggestions: [
        'Refresh the page and try again',
        'Check if browser extensions are interfering',
        'Try in an incognito/private browser window'
      ]
    },
    PROCESSING_FAILED: {
      code: 'PROCESSING_FAILED',
      message: 'Image processing failed',
      userMessage: 'Failed to process the image. The file may be corrupted or in an unsupported format.',
      retryable: false,
      suggestions: [
        'Try a different image file',
        'Convert the image to JPEG or PNG format',
        'Reduce the image size or quality'
      ]
    }
  };

  /**
   * Analyzes an error and returns comprehensive error information
   */
  static analyzeError(error: any, context: Partial<ErrorAnalysis['context']> = {}): ErrorAnalysis {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorLower = errorMessage.toLowerCase();

    let primaryError: UploadError;

    // Pattern matching for different error types
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      primaryError = this.ERROR_PATTERNS.NETWORK_TIMEOUT;
    } else if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('connection')) {
      primaryError = this.ERROR_PATTERNS.NETWORK_ERROR;
    } else if (errorLower.includes('file size') || errorLower.includes('too large') || errorLower.includes('exceeds')) {
      primaryError = this.ERROR_PATTERNS.FILE_TOO_LARGE;
    } else if (errorLower.includes('invalid file type') || errorLower.includes('unsupported format') || errorLower.includes('file format')) {
      primaryError = this.ERROR_PATTERNS.INVALID_FILE_TYPE;
    } else if (errorLower.includes('corrupted') || errorLower.includes('invalid image') || errorLower.includes('malformed')) {
      primaryError = this.ERROR_PATTERNS.FILE_CORRUPTED;
    } else if (errorLower.includes('unauthorized') || errorLower.includes('permission') || errorLower.includes('access denied')) {
      primaryError = this.ERROR_PATTERNS.PERMISSION_DENIED;
    } else if (errorLower.includes('rate limit') || errorLower.includes('too many')) {
      primaryError = this.ERROR_PATTERNS.RATE_LIMIT_EXCEEDED;
    } else if (errorLower.includes('storage') && errorLower.includes('full')) {
      primaryError = this.ERROR_PATTERNS.STORAGE_FULL;
    } else if (errorLower.includes('content security policy') || errorLower.includes('csp')) {
      primaryError = this.ERROR_PATTERNS.CSP_VIOLATION;
    } else if (errorLower.includes('processing') || errorLower.includes('resize') || errorLower.includes('canvas')) {
      primaryError = this.ERROR_PATTERNS.PROCESSING_FAILED;
    } else if (errorLower.includes('server') || errorLower.includes('internal') || error?.status >= 500) {
      primaryError = this.ERROR_PATTERNS.SERVER_ERROR;
    } else {
      // Default fallback error
      primaryError = {
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
        userMessage: 'An unexpected error occurred during upload.',
        retryable: true,
        suggestions: [
          'Try again in a few moments',
          'Check your internet connection',
          'Contact support if the problem persists'
        ]
      };
    }

    return {
      primaryError,
      context
    };
  }

  /**
   * Generates a user-friendly error message with suggestions
   */
  static generateUserMessage(analysis: ErrorAnalysis): string {
    const { primaryError, context } = analysis;
    let message = primaryError.userMessage;

    // Add context-specific information
    if (context.fileSize && context.fileSize > 5 * 1024 * 1024) {
      message += ` Your image is ${(context.fileSize / (1024 * 1024)).toFixed(1)}MB.`;
    }

    if (context.fileType && !['image/jpeg', 'image/png', 'image/webp'].includes(context.fileType)) {
      message += ` The file type is ${context.fileType}.`;
    }

    return message;
  }

  /**
   * Determines if an error should trigger a retry
   */
  static shouldRetry(analysis: ErrorAnalysis, currentAttempt: number, maxAttempts: number): boolean {
    if (currentAttempt >= maxAttempts) return false;
    if (!analysis.primaryError.retryable) return false;

    // Special handling for certain error types
    if (analysis.primaryError.code === 'RATE_LIMIT_EXCEEDED' && currentAttempt < 2) {
      return true;
    }

    if (analysis.primaryError.code === 'NETWORK_TIMEOUT' && currentAttempt < maxAttempts) {
      return true;
    }

    return analysis.primaryError.retryable && currentAttempt < maxAttempts;
  }

  /**
   * Calculates retry delay based on error type and attempt number
   */
  static getRetryDelay(analysis: ErrorAnalysis, attempt: number): number {
    const baseDelay = 1000; // 1 second base delay

    switch (analysis.primaryError.code) {
      case 'RATE_LIMIT_EXCEEDED':
        return Math.min(30000, baseDelay * Math.pow(3, attempt)); // Up to 30 seconds
      case 'NETWORK_TIMEOUT':
      case 'NETWORK_ERROR':
        return Math.min(10000, baseDelay * Math.pow(2, attempt)); // Up to 10 seconds
      case 'SERVER_ERROR':
        return Math.min(15000, baseDelay * Math.pow(2.5, attempt)); // Up to 15 seconds
      default:
        return Math.min(5000, baseDelay * Math.pow(1.5, attempt)); // Up to 5 seconds
    }
  }

  /**
   * Logs error details for debugging
   */
  static logError(analysis: ErrorAnalysis, context: any = {}): void {
    console.group('🚨 Upload Error Analysis');
    console.error('Error Code:', analysis.primaryError.code);
    console.error('Original Message:', analysis.primaryError.message);
    console.error('User Message:', analysis.primaryError.userMessage);
    console.error('Retryable:', analysis.primaryError.retryable);
    console.error('Context:', analysis.context);
    console.error('Additional Context:', context);
    console.error('Suggestions:', analysis.primaryError.suggestions);
    console.groupEnd();
  }
}

/**
 * Helper function to handle upload errors consistently
 */
export const handleUploadError = (
  error: any, 
  context: Partial<ErrorAnalysis['context']> = {},
  onError?: (analysis: ErrorAnalysis) => void
): ErrorAnalysis => {
  const analysis = UploadErrorHandler.analyzeError(error, context);
  UploadErrorHandler.logError(analysis, { timestamp: new Date().toISOString() });
  
  if (onError) {
    onError(analysis);
  }
  
  return analysis;
};