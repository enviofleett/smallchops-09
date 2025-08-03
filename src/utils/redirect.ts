// Utility functions for handling authentication redirects

const REDIRECT_URL_KEY = 'auth_redirect_url';

export const storeRedirectUrl = (url: string) => {
  try {
    localStorage.setItem(REDIRECT_URL_KEY, url);
  } catch (error) {
    console.warn('Failed to store redirect URL:', error);
  }
};

export const getStoredRedirectUrl = (): string | null => {
  try {
    return localStorage.getItem(REDIRECT_URL_KEY);
  } catch (error) {
    console.warn('Failed to get stored redirect URL:', error);
    return null;
  }
};

export const clearStoredRedirectUrl = () => {
  try {
    localStorage.removeItem(REDIRECT_URL_KEY);
  } catch (error) {
    console.warn('Failed to clear stored redirect URL:', error);
  }
};

export const getDefaultRedirectPath = (userType: 'admin' | 'customer' | 'unknown' = 'unknown'): string => {
  switch (userType) {
    case 'admin':
      return '/dashboard';
    case 'customer':
      return '/customer-portal';
    default:
      return '/';
  }
};

export const handlePostLoginRedirect = (userType: 'admin' | 'customer'): string => {
  const storedUrl = getStoredRedirectUrl();
  
  if (storedUrl) {
    clearStoredRedirectUrl();
    // Validate that the stored URL is safe (belongs to our app)
    try {
      const url = new URL(storedUrl, window.location.origin);
      if (url.origin === window.location.origin) {
        return url.pathname + url.search + url.hash;
      }
    } catch (error) {
      console.warn('Invalid stored redirect URL:', storedUrl);
    }
  }
  
  return getDefaultRedirectPath(userType);
};