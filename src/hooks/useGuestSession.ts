import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GuestSession {
  sessionId: string;
  isGuest: boolean;
}

interface GuestSessionHook {
  guestSession: GuestSession | null;
  generateGuestSession: () => Promise<string>;
  convertGuestToCustomer: (customerId: string) => Promise<void>;
  clearGuestSession: () => void;
}

const GUEST_SESSION_KEY = 'guest_session_id';
const GUEST_SESSION_COOKIE = 'guest_session';

export const useGuestSession = (): GuestSessionHook => {
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);

  // Generate a new guest session ID
  const generateGuestSession = useCallback(async (): Promise<string> => {
    try {
      // Try to call Supabase function to generate secure guest session ID
      const { data, error } = await supabase.rpc('generate_guest_session_id');

      if (error) {
        console.warn('RPC generate_guest_session_id not available, using fallback:', error.message);
        // Fallback to client-side generation
        const fallbackId = `guest_${crypto.randomUUID()}`;
        storeGuestSession(fallbackId);
        return fallbackId;
      }

      if (data && typeof data === 'string') {
        const sessionId = data as string;
        storeGuestSession(sessionId);
        return sessionId;
      } else {
        console.warn('RPC returned invalid data, using fallback:', data);
        const fallbackId = `guest_${crypto.randomUUID()}`;
        storeGuestSession(fallbackId);
        return fallbackId;
      }
    } catch (error) {
      console.warn('RPC call failed, using fallback:', error);
      // Always fallback to client-side generation
      const fallbackId = `guest_${crypto.randomUUID()}`;
      storeGuestSession(fallbackId);
      return fallbackId;
    }
  }, []);

  // Store guest session in both localStorage and cookie
  const storeGuestSession = useCallback((sessionId: string) => {
    try {
      localStorage.setItem(GUEST_SESSION_KEY, sessionId);
      
      // Set cookie with 30 day expiration
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      document.cookie = `${GUEST_SESSION_COOKIE}=${sessionId}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
      
      setGuestSession({
        sessionId,
        isGuest: true
      });
    } catch (error) {
      console.error('Error storing guest session:', error);
    }
  }, []);

  // Get existing guest session from storage
  const getStoredGuestSession = useCallback((): string | null => {
    try {
      // Try localStorage first
      const stored = localStorage.getItem(GUEST_SESSION_KEY);
      if (stored) return stored;

      // Fallback to cookie
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === GUEST_SESSION_COOKIE) {
          return value;
        }
      }
    } catch (error) {
      console.error('Error retrieving guest session:', error);
    }
    return null;
  }, []);

  // Convert guest session to customer account
  const convertGuestToCustomer = useCallback(async (customerId: string) => {
    if (!guestSession?.sessionId) return;

    try {
      const { data, error } = await supabase.rpc('convert_guest_cart_to_customer', {
        p_guest_session_id: guestSession.sessionId,
        p_customer_id: customerId
      });

      if (error) {
        console.error('Error converting guest to customer:', error);
        return;
      }

      console.log('Guest conversion successful:', data);
      clearGuestSession();
    } catch (error) {
      console.error('Error in convertGuestToCustomer:', error);
    }
  }, [guestSession]);

  // Clear guest session
  const clearGuestSession = useCallback(() => {
    try {
      localStorage.removeItem(GUEST_SESSION_KEY);
      document.cookie = `${GUEST_SESSION_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      setGuestSession(null);
    } catch (error) {
      console.error('Error clearing guest session:', error);
    }
  }, []);

  // Initialize guest session on mount
  useEffect(() => {
    const existingSession = getStoredGuestSession();
    if (existingSession) {
      setGuestSession({
        sessionId: existingSession,
        isGuest: true
      });
    }
  }, [getStoredGuestSession]);

  return {
    guestSession,
    generateGuestSession,
    convertGuestToCustomer,
    clearGuestSession
  };
};
