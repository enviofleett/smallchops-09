
import React from "react";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import BusinessForm from "./BusinessForm";

const BusinessTab = () => {
  const { 
    business, 
    loading, 
    uploadingLogo,
    handleSubmit, 
    handleChange, 
    handleLogoUpload 
  } = useBusinessSettings();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-1">Business Information</h2>
        <p className="text-gray-500 text-sm">Update your restaurant&apos;s basic information and upload your logo.</p>
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
