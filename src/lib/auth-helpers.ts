
import { supabase } from '@/integrations/supabase/client';

// Helper function to get current user's email for RLS policies
export const getCurrentUserEmail = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email || null;
};

// Client-side helper to check if user is admin
export const checkIsAdmin = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    return data || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};
