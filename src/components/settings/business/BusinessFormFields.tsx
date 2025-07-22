
import React from 'react';
import { Input } from '@/components/ui/input';
import { ImageUpload } from '@/components/ui/image-upload';
import type { BusinessSettings } from '@/types/businessSettings';

interface BusinessFormFieldsProps {
  formData: BusinessSettings;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoUpload: (file: File | null) => void;
  disabled: boolean;
  uploadingLogo: boolean;
}

const BusinessFormFields: React.FC<BusinessFormFieldsProps> = ({
  formData,
  onChange,
  onLogoUpload,
  disabled,
  uploadingLogo
}) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Business Name *
          </label>
          <Input 
            type="text" 
            name="name" 
            placeholder="Business name" 
            value={formData.name} 
            onChange={onChange} 
            disabled={disabled}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Contact Email
          </label>
          <Input 
            type="email" 
            name="email" 
            placeholder="info@email.com" 
            value={formData.email} 
            onChange={onChange} 
            disabled={disabled}
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Business Address
        </label>
        <Input 
          type="text" 
          name="address" 
          placeholder="Address" 
          value={formData.address} 
          onChange={onChange} 
          disabled={disabled}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Phone Number
          </label>
          <Input 
            type="tel" 
            name="phone" 
            placeholder="+1234567890" 
            value={formData.phone} 
            onChange={onChange} 
            disabled={disabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Working Hours
          </label>
          <Input 
            type="text" 
            name="working_hours" 
            placeholder="eg. 9am-5pm" 
            value={formData.working_hours} 
            onChange={onChange} 
            disabled={disabled}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Registration Number
          </label>
          <Input 
            type="text" 
            name="registration_number" 
            placeholder="Reg. Number" 
            value={formData.registration_number} 
            onChange={onChange} 
            disabled={disabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">
            Tax ID
          </label>
          <Input 
            type="text" 
            name="tax_id" 
            placeholder="Tax ID" 
            value={formData.tax_id} 
            onChange={onChange} 
            disabled={disabled}
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Licenses
        </label>
        <Input 
          type="text" 
          name="licenses" 
          placeholder="Licenses" 
          value={formData.licenses} 
          onChange={onChange} 
          disabled={disabled}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          Business Logo
        </label>
        <ImageUpload 
          value={formData.logo_url}
          onChange={onLogoUpload}
          disabled={disabled || uploadingLogo}
        />
        {uploadingLogo && (
          <p className="text-sm text-blue-600 mt-2">Uploading logo...</p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Social Links (JSON)
        </label>
        <Input 
          type="text" 
          name="social_links" 
          placeholder='{"facebook":"..."}' 
          value={formData.social_links} 
          onChange={onChange} 
          disabled={disabled}
        />
      </div>
    </>
  );
};

export default BusinessFormFields;
