import { Database } from '@/integrations/supabase/types';

export type Product = Database['public']['Tables']['products']['Row'];
export type NewProduct = Database['public']['Tables']['products']['Insert'];
export type UpdatedProduct = Database['public']['Tables']['products']['Update'];

export type Category = Database['public']['Tables']['categories']['Row'];
export type NewCategory = Database['public']['Tables']['categories']['Insert'];
export type UpdatedCategory = Database['public']['Tables']['categories']['Update'];

export type ProductWithCategory = Product & {
  categories: Pick<Category, 'id' | 'name'> | null;
};

// Content management types using existing tables
export type SiteContent = Database['public']['Tables']['content_management']['Row'];
export type NewSiteContent = Database['public']['Tables']['content_management']['Insert'];
export type UpdatedSiteContent = Database['public']['Tables']['content_management']['Update'];

export type MenuSection = Database['public']['Enums']['menu_section'];
export type PermissionLevel = Database['public']['Enums']['permission_level'];
export type UserPermission = Database['public']['Tables']['user_permissions']['Row'];

export type DeliveryZone = Database['public']['Tables']['delivery_zones']['Row'];
export type NewDeliveryZone = Database['public']['Tables']['delivery_zones']['Insert'];
export type UpdatedDeliveryZone = Database['public']['Tables']['delivery_zones']['Update'];

export type DeliveryFee = Database['public']['Tables']['delivery_fees']['Row'];
export type NewDeliveryFee = Database['public']['Tables']['delivery_fees']['Insert'];
export type UpdatedDeliveryFee = Database['public']['Tables']['delivery_fees']['Update'];

export type MapSettings = Database['public']['Tables']['map_settings']['Row'];
export type MapApiUsage = Database['public']['Tables']['map_api_usage']['Row'];
