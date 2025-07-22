
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
      
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          Social Media Links
        </label>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Facebook URL
            </label>
            <Input 
              type="url" 
              name="facebook_url" 
              placeholder="https://facebook.com/your-page" 
              value={formData.facebook_url} 
              onChange={onChange} 
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Instagram URL
            </label>
            <Input 
              type="url" 
              name="instagram_url" 
              placeholder="https://instagram.com/your-page" 
              value={formData.instagram_url} 
              onChange={onChange} 
              disabled={disabled}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              TikTok URL
            </label>
            <Input 
              type="url" 
              name="tiktok_url" 
              placeholder="https://tiktok.com/@your-page" 
              value={formData.tiktok_url} 
              onChange={onChange} 
              disabled={disabled}
            />
          </div>
        </div>
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
      
    </>
  );
};

export default BusinessFormFields;
