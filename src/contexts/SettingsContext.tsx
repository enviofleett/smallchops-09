
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
          registration_number: item.registration_number || "",
          tax_id: item.tax_id || "",
          licenses: item.licenses || "",
          social_links: item.social_links
            ? typeof item.social_links === "string"
              ? item.social_links
              : JSON.stringify(item.social_links)
            : "",
        } as BusinessSettings;
      }
      
      return {
        name: "",
        email: "",
        address: "",
        phone: "",
        working_hours: "",
        logo_url: "",
        registration_number: "",
        tax_id: "",
        licenses: "",
        social_links: "",
      } as BusinessSettings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
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
