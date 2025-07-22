
import { useEffect, useState } from "react";
import { useErrorHandler } from "./useErrorHandler";
import { loadBusinessSettings, saveBusinessSettings } from "@/services/businessSettingsApi";
import { uploadLogo } from "@/services/logoUploadService";
import { isValidJson, parseSocialLinksValue } from "@/utils/businessValidation";
import type { BusinessSettings, BusinessSettingsHookReturn } from "@/types/businessSettings";

export const useBusinessSettings = (): BusinessSettingsHookReturn => {
  const { handleError, handleSuccess } = useErrorHandler();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessSettings>({
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
  });

  // Load existing settings from the edge function
  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
      try {
        console.log("Loading business settings...");
        const settings = await loadBusinessSettings();
        if (settings) {
          console.log("Business settings loaded:", settings);
          setBusiness(settings);
        } else {
          console.log("No existing business settings found, using defaults");
          // Keep the default empty settings - this is not an error
        }
      } catch (e: any) {
        console.error("Error loading business settings:", e);
        // Show user-friendly error message
        if (e.message.includes("Network error") || e.message.includes("Failed to fetch")) {
          handleError(new Error("Unable to connect to server. Please check your internet connection and try again."), "loading business settings");
        } else {
          handleError(e, "loading business settings");
        }
      } finally {
        setInitialLoading(false);
      }
    };
    load();
  }, [handleError]);

  // Handle logo file upload
  const handleLogoUpload = async (file: File | null) => {
    if (!file) {
      console.log("Removing logo...");
      setBusiness((prev) => ({ ...prev, logo_url: "" }));
      return;
    }

    console.log("Starting logo upload for file:", file.name, file.type, file.size);
    setUploadingLogo(true);
    try {
      const logoUrl = await uploadLogo(file);
      console.log("Logo upload successful:", logoUrl);
      setBusiness((prev) => ({ ...prev, logo_url: logoUrl }));
      handleSuccess("Logo uploaded successfully");
    } catch (error: any) {
      console.error("Logo upload failed:", error);
      handleError(error, "uploading logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Submit business data through edge function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!business.name.trim()) {
      handleError(new Error("Business name is required"), "form validation");
      return;
    }
    
    if (business.social_links && !isValidJson(business.social_links)) {
      handleError(new Error("Social Links must be valid JSON (e.g. {\"facebook\": \"...\"})"), "form validation");
      return;
    }

    console.log("Submitting business settings:", business);
    setLoading(true);

    try {
      const social_links_value = parseSocialLinksValue(business.social_links);
      const updatedSettings = await saveBusinessSettings(business, social_links_value);
      console.log("Business settings saved successfully:", updatedSettings);
      handleSuccess("Business information updated successfully");
      setBusiness(updatedSettings);
    } catch (err: any) {
      console.error("Error saving business settings:", err);
      // Show user-friendly error message
      if (err.message.includes("Network error") || err.message.includes("Failed to fetch")) {
        handleError(new Error("Unable to save changes. Please check your internet connection and try again."), "saving business settings");
      } else {
        handleError(err, "saving business settings");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusiness((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return {
    business,
    loading: loading || initialLoading,
    uploadingLogo,
    handleSubmit,
    handleChange,
    handleLogoUpload,
  };
};
