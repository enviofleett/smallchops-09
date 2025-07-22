
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BusinessSettings } from '@/types/businessSettings';

interface GlobalBusinessSettings {
  settings: BusinessSettings | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useGlobalBusinessSettings = (): GlobalBusinessSettings => {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.functions.invoke("business-settings", {
        method: "GET",
      });
      
      if (error) {
        console.error("Error fetching business settings:", error);
        setError("Failed to load business settings");
        return;
      }

      if (data?.data) {
        const item = data.data;
        const businessSettings: BusinessSettings = {
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
        };
        setSettings(businessSettings);
      } else {
        // No settings found, use defaults
        setSettings({
          name: "DotCrafts",
          email: "",
          address: "",
          phone: "",
          working_hours: "",
          logo_url: "",
          registration_number: "",
          tax_id: "",
          licenses: "",
          social_links: "",
        });
      }
    } catch (err) {
      console.error("Failed to fetch business settings:", err);
      setError("Failed to load business settings");
      // Set fallback defaults
      setSettings({
        name: "DotCrafts",
        email: "",
        address: "",
        phone: "",
        working_hours: "",
        logo_url: "",
        registration_number: "",
        tax_id: "",
        licenses: "",
        social_links: "",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
  };
};
