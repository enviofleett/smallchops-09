
export interface BusinessSettings {
  name: string;
  email: string;
  address: string;
  phone: string;
  working_hours: string;
  logo_url: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
}

export interface BusinessSettingsHookReturn {
  business: BusinessSettings;
  loading: boolean;
  uploadingLogo: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleLogoUpload: (file: File | null) => Promise<void>;
}
