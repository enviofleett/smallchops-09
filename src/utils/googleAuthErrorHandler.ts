// Google Authentication Error Handler
// Provides user-friendly error messages and recovery suggestions

export interface GoogleAuthError {
  code: string;
  message: string;
  userMessage: string;
  recoveryAction?: string;
}

export const handleGoogleAuthError = (error: any): GoogleAuthError => {
  const errorMessage = error?.message || error?.error_description || 'Unknown error';
  const errorCode = error?.error || error?.code || 'unknown_error';

  // Common Google OAuth error patterns
  if (errorMessage.includes('popup_closed_by_user') || errorCode === 'popup_closed_by_user') {
    return {
      code: 'popup_closed',
      message: errorMessage,
      userMessage: 'Sign-in was cancelled. Please try again.',
      recoveryAction: 'Click the Google sign-in button to try again.'
    };
  }

  if (errorMessage.includes('access_denied') || errorCode === 'access_denied') {
    return {
      code: 'access_denied',
      message: errorMessage,
      userMessage: 'Permission denied. Please allow access to continue.',
      recoveryAction: 'Make sure to grant permission when prompted by Google.'
    };
  }

  if (errorMessage.includes('redirect_uri_mismatch') || errorCode === 'redirect_uri_mismatch') {
    return {
      code: 'redirect_mismatch',
      message: errorMessage,
      userMessage: 'Configuration error. Please contact support.',
      recoveryAction: 'This appears to be a configuration issue. Please try again or contact support.'
    };
  }

  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return {
      code: 'network_error',
      message: errorMessage,
      userMessage: 'Network connection issue. Please check your internet and try again.',
      recoveryAction: 'Check your internet connection and try signing in again.'
    };
  }

  if (errorMessage.includes('popup_blocked')) {
    return {
      code: 'popup_blocked',
      message: errorMessage,
      userMessage: 'Pop-up blocked. Please allow pop-ups for this site.',
      recoveryAction: 'Enable pop-ups in your browser settings and try again.'
    };
  }

  if (errorMessage.includes('invalid_client') || errorCode === 'invalid_client') {
    return {
      code: 'invalid_client',
      message: errorMessage,
      userMessage: 'Google sign-in is temporarily unavailable.',
      recoveryAction: 'Please try again in a few minutes or use email sign-in.'
    };
  }

  // Default error
  return {
    code: 'unknown_error',
    message: errorMessage,
    userMessage: 'Google sign-in failed. Please try again or use email sign-in.',
    recoveryAction: 'Try again or use the email sign-in option below.'
  };
};

// Retry logic for Google Auth
export const retryGoogleAuth = async (
  authFunction: () => Promise<any>,
  maxRetries: number = 2,
  delay: number = 1000
): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await authFunction();
    } catch (error) {
      const authError = handleGoogleAuthError(error);
      
      // Don't retry user-cancelled actions or config errors
      if (['popup_closed', 'access_denied', 'redirect_mismatch'].includes(authError.code)) {
        throw authError;
      }
      
      // On last attempt, throw the error
      if (attempt === maxRetries) {
        throw authError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
};
