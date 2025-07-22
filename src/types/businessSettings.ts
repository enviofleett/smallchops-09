
export interface BusinessSettings {
  name: string;
  email: string;
  address: string;
  phone: string;
  working_hours: string;
  logo_url: string;
  registration_number: string;
  tax_id: string;
  licenses: string;
  social_links: string; // JSON string in the form
}

export interface BusinessSettingsHookReturn {
  business: BusinessSettings;
  loading: boolean;
  uploadingLogo: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLogoUpload: (file: File | null) => Promise<void>;
}
