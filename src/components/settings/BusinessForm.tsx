import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import type { BusinessSettings } from "@/types/businessSettings";

interface BusinessFormProps {
  business: BusinessSettings;
  loading: boolean;
  uploadingLogo?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoUpload?: (file: File | null) => void;
}

const BusinessForm = ({ 
  business, 
  loading, 
  uploadingLogo = false,
  onSubmit, 
  onChange, 
  onLogoUpload 
}: BusinessFormProps) => {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Business Name</label>
          <Input 
            type="text" 
            name="name" 
            placeholder="Business name" 
            value={business.name} 
            onChange={onChange} 
            disabled={loading} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Contact Email</label>
          <Input 
            type="email" 
            name="email" 
            placeholder="info@email.com" 
            value={business.email} 
            onChange={onChange} 
            disabled={loading} 
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">Business Address</label>
        <Input 
          type="text" 
          name="address" 
          placeholder="Address" 
          value={business.address} 
          onChange={onChange} 
          disabled={loading} 
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Phone Number</label>
          <Input 
            type="tel" 
            name="phone" 
            placeholder="+1234567890" 
            value={business.phone} 
            onChange={onChange} 
            disabled={loading} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Working Hours</label>
          <Input 
            type="text" 
            name="working_hours" 
            placeholder="eg. 9am-5pm" 
            value={business.working_hours} 
            onChange={onChange} 
            disabled={loading} 
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Business Registration Number</label>
          <Input 
            type="text" 
            name="registration_number" 
            placeholder="Reg. Number" 
            value={business.registration_number} 
            onChange={onChange} 
            disabled={loading} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Tax ID</label>
          <Input 
            type="text" 
            name="tax_id" 
            placeholder="Tax ID" 
            value={business.tax_id} 
            onChange={onChange} 
            disabled={loading} 
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">Licenses</label>
        <Input 
          type="text" 
          name="licenses" 
          placeholder="Licenses" 
          value={business.licenses} 
          onChange={onChange} 
          disabled={loading} 
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">Business Logo</label>
        <ImageUpload 
          value={business.logo_url}
          onChange={onLogoUpload}
          disabled={loading || uploadingLogo}
        />
        {uploadingLogo && (
          <p className="text-sm text-blue-600 mt-2">Uploading logo...</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">Social Links (JSON)</label>
        <Input 
          type="text" 
          name="social_links" 
          placeholder='{"facebook":"..."}' 
          value={business.social_links} 
          onChange={onChange} 
          disabled={loading} 
        />
      </div>
      <div className="pt-2">
        <Button type="submit" className="px-7 rounded-lg text-base font-medium" disabled={loading || uploadingLogo}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
};

export default BusinessForm;
