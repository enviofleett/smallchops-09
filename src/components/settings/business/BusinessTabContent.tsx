
import React, { useState, useCallback, useMemo } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useDebounce } from '@/hooks/use-debounce';
import { saveBusinessSettings } from '@/services/businessSettingsApi';
import { uploadLogo } from '@/services/logoUploadService';
import { isValidJson, parseSocialLinksValue } from '@/utils/businessValidation';
import BusinessFormFields from './BusinessFormFields';
import BusinessFormActions from './BusinessFormActions';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { BusinessSettings } from '@/types/businessSettings';

const BusinessTabContent: React.FC = () => {
  const { businessSettings, isLoading, error, refetchBusinessSettings } = useSettingsContext();
  const { handleError, handleSuccess } = useErrorHandler();
  
  const [formData, setFormData] = useState<BusinessSettings>(() => ({
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
  }));
  
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Update form data when business settings load
  React.useEffect(() => {
    if (businessSettings) {
      setFormData(businessSettings);
    }
  }, [businessSettings]);

  // Debounced form validation
  const debouncedFormData = useDebounce(formData, 300);
  
  const validationError = useMemo(() => {
    if (!debouncedFormData.name.trim()) {
      return "Business name is required";
    }
    if (debouncedFormData.social_links && !isValidJson(debouncedFormData.social_links)) {
      return "Social Links must be valid JSON";
    }
    return null;
  }, [debouncedFormData]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleLogoUpload = useCallback(async (file: File | null) => {
    if (!file) {
      setFormData(prev => ({ ...prev, logo_url: "" }));
      return;
    }

    setUploadingLogo(true);
    try {
      const logoUrl = await uploadLogo(file);
      setFormData(prev => ({ ...prev, logo_url: logoUrl }));
      handleSuccess("Logo uploaded successfully");
    } catch (error: any) {
      handleError(error, "uploading logo");
    } finally {
      setUploadingLogo(false);
    }
  }, [handleError, handleSuccess]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (validationError) {
      handleError(new Error(validationError), "form validation");
      return;
    }

    setSaving(true);
    try {
      const social_links_value = parseSocialLinksValue(formData.social_links);
      await saveBusinessSettings(formData, social_links_value);
      handleSuccess("Business information updated successfully");
      await refetchBusinessSettings();
    } catch (err: any) {
      handleError(err, "saving business settings");
    } finally {
      setSaving(false);
    }
  }, [formData, validationError, handleError, handleSuccess, refetchBusinessSettings]);

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-3xl">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Failed to load business settings: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-3xl">
        <div className="mb-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xl font-semibold text-gray-800">Business Information</h2>
          {navigator.onLine ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
        </div>
        <p className="text-gray-500 text-sm">
          Update your business information and upload your logo.
        </p>
        
        {!navigator.onLine && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You appear to be offline. Changes may not be saved until your connection is restored.
            </AlertDescription>
          </Alert>
        )}

        {validationError && (
          <Alert className="mt-4 border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              {validationError}
            </AlertDescription>
          </Alert>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <BusinessFormFields
          formData={formData}
          onChange={handleChange}
          onLogoUpload={handleLogoUpload}
          disabled={saving}
          uploadingLogo={uploadingLogo}
        />
        <BusinessFormActions
          saving={saving}
          uploadingLogo={uploadingLogo}
          disabled={!!validationError}
        />
      </form>
    </div>
  );
};

export default BusinessTabContent;
