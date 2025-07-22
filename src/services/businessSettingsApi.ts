
import { supabase } from "@/integrations/supabase/client";
import type { BusinessSettings } from "@/types/businessSettings";

export const loadBusinessSettings = async (): Promise<BusinessSettings | null> => {
  console.log("Loading business settings...");
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
      registration_number: item.registration_number || "",
      tax_id: item.tax_id || "",
      licenses: item.licenses || "",
      social_links: item.social_links
        ? typeof item.social_links === "string"
          ? item.social_links
          : JSON.stringify(item.social_links)
        : "",
    };
  }

  console.log("No existing business settings found");
  return null;
};

export const saveBusinessSettings = async (
  business: BusinessSettings,
  social_links_value: any
): Promise<BusinessSettings> => {
  console.log("Submitting business settings...", business);
  const { data, error } = await supabase.functions.invoke("business-settings", {
    body: {
      ...business,
      social_links: social_links_value,
    },
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
      registration_number: item.registration_number || "",
      tax_id: item.tax_id || "",
      licenses: item.licenses || "",
      social_links: item.social_links
        ? typeof item.social_links === "string"
          ? item.social_links
          : JSON.stringify(item.social_links)
        : "",
    };
  }

  throw new Error("Failed to save business settings");
};
