
import { useEffect, useState } from "react";
import { useErrorHandler } from "./useErrorHandler";
import { loadBusinessSettings, saveBusinessSettings } from "@/services/businessSettingsApi";
import { uploadLogo } from "@/services/logoUploadService";
import type { BusinessSettings, BusinessSettingsHookReturn } from "@/types/businessSettings";
import { useGlobalBusinessSettings } from "./useGlobalBusinessSettings";

export const useBusinessSettings = (): BusinessSettingsHookReturn => {
  const { handleError, handleSuccess } = useErrorHandler();
  const { refetch: refetchGlobal } = useGlobalBusinessSettings();
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
    facebook_url: "",
    instagram_url: "",
    tiktok_url: "",
  });

  // Load existing settings from the edge function
  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
      try {
        console.log("useBusinessSettings: Loading business settings...");
        const settings = await loadBusinessSettings();
        if (settings) {
          console.log("useBusinessSettings: Business settings loaded:", settings);
          setBusiness(settings);
        } else {
          console.log("useBusinessSettings: No existing business settings found, using defaults");
        }
      } catch (e: any) {
        console.error("useBusinessSettings: Error loading business settings:", e);
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
      console.log("useBusinessSettings: Removing logo...");
      setBusiness((prev) => ({ ...prev, logo_url: "" }));
      return;
    }

    console.log("useBusinessSettings: Starting logo upload for file:", file.name, file.type, file.size);
    setUploadingLogo(true);
    try {
      const logoUrl = await uploadLogo(file);
      console.log("useBusinessSettings: Logo upload successful:", logoUrl);
      setBusiness((prev) => ({ ...prev, logo_url: logoUrl }));
      handleSuccess("Logo uploaded successfully");
    } catch (error: any) {
      console.error("useBusinessSettings: Logo upload failed:", error);
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
    
    console.log("useBusinessSettings: Submitting business settings:", business);
    setLoading(true);

    try {
      const updatedSettings = await saveBusinessSettings(business, null);
      console.log("useBusinessSettings: Business settings saved successfully:", updatedSettings);
      handleSuccess("Business information updated successfully");
      setBusiness(updatedSettings);
      
      // Refresh global business settings to update header/sidebar
      console.log("useBusinessSettings: Refreshing global business settings...");
      await refetchGlobal();
    } catch (err: any) {
      console.error("useBusinessSettings: Error saving business settings:", err);
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
    const { name, value } = e.target;
    console.log("useBusinessSettings: Field changed:", name, "=", value);
    setBusiness((prev) => ({ ...prev, [name]: value }));
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
