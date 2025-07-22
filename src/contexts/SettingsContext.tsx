
import React, { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BusinessSettings } from '@/types/businessSettings';

interface SettingsContextType {
  businessSettings: BusinessSettings | null;
  isLoading: boolean;
  error: string | null;
  refetchBusinessSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  const {
    data: businessSettings,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['business-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("business-settings", {
        method: "GET",
      });
      
      if (error) throw error;
      
      if (data?.data) {
        const item = data.data;
        return {
          name: item.name || "",
          email: item.email || "",
          address: item.address || "",
          phone: item.phone || "",
          working_hours: item.working_hours || "",
          logo_url: item.logo_url || "",
          facebook_url: item.facebook_url || "",
          instagram_url: item.instagram_url || "",
          tiktok_url: item.tiktok_url || "",
        } as BusinessSettings;
      }
      
      return {
        name: "",
        email: "",
        address: "",
        phone: "",
        working_hours: "",
        logo_url: "",
        facebook_url: "",
        instagram_url: "",
        tiktok_url: "",
      } as BusinessSettings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const refetchBusinessSettings = async () => {
    await refetch();
    // Also invalidate global business settings
    queryClient.invalidateQueries({ queryKey: ['global-business-settings'] });
  };

  return (
    <SettingsContext.Provider
      value={{
        businessSettings: businessSettings || null,
        isLoading,
        error: error?.message || null,
        refetchBusinessSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
