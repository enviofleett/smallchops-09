import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useCustomerAuth } from './useCustomerAuth';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerBooking {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  event_date: string;
  number_of_guests: number;
  additional_details: string | null;
  status: string;
  quote_amount: number | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  updated_at: string;
}

export const useCustomerBookings = () => {
  const { isAuthenticated, customerAccount, user } = useCustomerAuth();

  const query = useQuery({
    queryKey: ['customer-bookings', customerAccount?.email, user?.email],
    queryFn: async () => {
      // Get the user's email for booking lookup
      const userEmail = user?.email || customerAccount?.email;
      
      if (!userEmail) {
        throw new Error('User email not found');
      }

      // Fetch bookings by customer email
      const { data: bookings, error } = await supabase
        .from('catering_bookings')
        .select('*')
        .eq('email', userEmail.toLowerCase())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer bookings:', error);
        throw error;
      }

      return {
        bookings: bookings || [],
        total: bookings?.length || 0
      };
    },
    enabled: isAuthenticated && (!!customerAccount?.email || !!user?.email),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Set up real-time updates for customer bookings
  useEffect(() => {
    if (!isAuthenticated || (!customerAccount?.email && !user?.email)) {
      return;
    }

    const userEmail = user?.email || customerAccount?.email;
    if (!userEmail) return;

    const channel = supabase
      .channel('customer-bookings-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'catering_bookings',
          filter: `email=eq.${userEmail.toLowerCase()}`
        },
        () => {
          console.log('Customer booking updated, refetching...');
          query.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, customerAccount?.email, user?.email, query]);

  return query;
};