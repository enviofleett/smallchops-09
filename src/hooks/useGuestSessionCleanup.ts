import { useEffect } from 'react';

/**
 * Hook to clean up guest session storage since guest mode is discontinued
 */
export const useGuestSessionCleanup = () => {
  useEffect(() => {
    try {
      // Clear any existing guest session data
      const guestSessionKey = 'guest_session_id';
      const guestSessionCookie = 'guest_session';
      
      // Remove from localStorage
      if (localStorage.getItem(guestSessionKey)) {
        localStorage.removeItem(guestSessionKey);
        console.log('🧹 Cleared guest session from localStorage');
      }
      
      // Clear guest session cookie
      document.cookie = `${guestSessionCookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      console.log('🧹 Cleared guest session cookie');
      
      // Clear any other guest-related storage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('guest')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🧹 Cleared guest-related key:', key);
      });
      
    } catch (error) {
      console.warn('⚠️ Guest session cleanup failed (non-critical):', error);
    }
  }, []);
};