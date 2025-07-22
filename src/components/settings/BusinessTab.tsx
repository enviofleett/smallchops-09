
import React from "react";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import BusinessForm from "./BusinessForm";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BusinessTab = () => {
  const { 
    business, 
    loading, 
    uploadingLogo,
    handleSubmit, 
    handleChange, 
    handleLogoUpload 
  } = useBusinessSettings();

  // Show loading skeleton during initial load
  if (loading && !business.name) {
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
        <p className="text-gray-500 text-sm">Update your restaurant&apos;s basic information and upload your logo.</p>
        
        {!navigator.onLine && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You appear to be offline. Changes may not be saved until your connection is restored.
            </AlertDescription>
          </Alert>
        )}
      </div>
      
      <BusinessForm 
        business={business}
        loading={loading}
        uploadingLogo={uploadingLogo}
        onSubmit={handleSubmit}
        onChange={handleChange}
        onLogoUpload={handleLogoUpload}
      />
    </div>
  );
};

export default BusinessTab;
