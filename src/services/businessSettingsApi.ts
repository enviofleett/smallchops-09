
import { supabase } from "@/integrations/supabase/client";
import type { BusinessSettings } from "@/types/businessSettings";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.log(`Operation failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await delay(RETRY_DELAY);
      return retryOperation(operation, retries - 1);
    }
    throw error;
  }
};

export const loadBusinessSettings = async (): Promise<BusinessSettings | null> => {
  console.log("Loading business settings...");
  
  return retryOperation(async () => {
    const { data, error } = await supabase.functions.invoke("business-settings", {
      method: "GET",
    });
    
    if (error) {
      console.error("Supabase function error:", error);
      throw new Error(`Network error: ${error.message}`);
    }

    if (data?.error) {
      console.error("Function returned error:", data.error);
      throw new Error(data.error);
    }

    if (data?.data) {
      const item = data.data;
      console.log("Business settings loaded successfully", item);

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
      };
    }

    console.log("No existing business settings found");
    return null;
  });
};

export const saveBusinessSettings = async (
  business: BusinessSettings,
  social_links_value: any
): Promise<BusinessSettings> => {
  console.log("Submitting business settings...", business);
  
  return retryOperation(async () => {
    const { data, error } = await supabase.functions.invoke("business-settings", {
      body: business,
    });

    if (error) {
      console.error("Supabase function error:", error);
      throw new Error(`Network error: ${error.message}`);
    }

    if (data?.error) {
      console.error("Function returned error:", data.error);
      throw new Error(data.error);
    }

    if (data?.data) {
      console.log("Business settings saved successfully");
      
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
      };
    }

    throw new Error("Failed to save business settings");
  });
};
