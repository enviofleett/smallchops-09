import { supabase } from '@/integrations/supabase/client';

export interface CustomerProfile {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  date_of_birth?: string;
  avatar_url?: string;
  bio?: string;
  email_verified: boolean;
  phone_verified: boolean;
  profile_completion_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  address_type: 'delivery' | 'billing' | 'other';
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code?: string;
  country: string;
  is_default: boolean;
  delivery_instructions?: string;
  landmark?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerPreferences {
  id: string;
  customer_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
  order_updates: boolean;
  price_alerts: boolean;
  promotion_alerts: boolean;
  newsletter_subscription: boolean;
  preferred_language: string;
  preferred_currency: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileActivity {
  id: string;
  customer_id: string;
  action_type: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface CustomerAnalytics {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  favoriteCategories: Array<{ name: string; count: number }>;
  recentOrders: any[];
  loyaltyPoints?: number;
  memberSince: string;
}

// Profile Management
export const getCustomerProfile = async (): Promise<CustomerProfile | null> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return null; // Guest user, return null
    }

    const { data, error } = await (supabase as any)
      .from('customer_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    return data as CustomerProfile;
  } catch (error) {
    console.error('Error getting customer profile:', error);
    return null;
  }
};

export const updateCustomerProfile = async (updates: Partial<CustomerProfile>): Promise<CustomerProfile> => {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('User not authenticated');

  // First get current profile
  const currentProfile = await getCustomerProfile();
  if (!currentProfile) throw new Error('Profile not found');

  const { data, error } = await (supabase as any)
    .from('customer_accounts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Log the profile update
  await supabase.functions.invoke('log-profile-activity', {
    body: {
      customer_id: currentProfile.id,
      action_type: 'profile_update',
      changes: updates
    }
  });

  return data as CustomerProfile;
};

// Address Management
export const getCustomerAddresses = async (): Promise<CustomerAddress[]> => {
  const profile = await getCustomerProfile();
  if (!profile) throw new Error('Profile not found');

  const { data, error } = await (supabase as any)
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', profile.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as CustomerAddress[];
};

export const addCustomerAddress = async (address: Omit<CustomerAddress, 'id' | 'customer_id' | 'created_at' | 'updated_at'>): Promise<CustomerAddress> => {
  const profile = await getCustomerProfile();
  if (!profile) throw new Error('Profile not found');

  // If this is set as default, unset other defaults
  if (address.is_default) {
    await (supabase as any)
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', profile.id);
  }

  const { data, error } = await (supabase as any)
    .from('customer_addresses')
    .insert({
      ...address,
      customer_id: profile.id,
      postal_code: address.postal_code || '' // Provide empty string if not provided
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Log activity
  await supabase.functions.invoke('log-profile-activity', {
    body: {
      customer_id: profile.id,
      action_type: 'address_added',
      new_value: `${address.address_line_1}, ${address.city}`
    }
  });

  return data as CustomerAddress;
};

export const updateCustomerAddress = async (addressId: string, updates: Partial<CustomerAddress>): Promise<CustomerAddress> => {
  const profile = await getCustomerProfile();
  if (!profile) throw new Error('Profile not found');

  // If this is set as default, unset other defaults
  if (updates.is_default) {
    await (supabase as any)
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', profile.id)
      .neq('id', addressId);
  }

  const { data, error } = await (supabase as any)
    .from('customer_addresses')
    .update({
      ...updates,
      postal_code: updates.postal_code || '' // Ensure postal_code is always a string
    })
    .eq('id', addressId)
    .eq('customer_id', profile.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CustomerAddress;
};

export const deleteCustomerAddress = async (addressId: string): Promise<void> => {
  const profile = await getCustomerProfile();
  if (!profile) throw new Error('Profile not found');

  const { error } = await (supabase as any)
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', profile.id);

  if (error) throw new Error(error.message);

  // Log activity
  await supabase.functions.invoke('log-profile-activity', {
    body: {
      customer_id: profile.id,
      action_type: 'address_deleted'
    }
  });
};

// Preferences Management
export const getCustomerPreferences = async (): Promise<CustomerPreferences | null> => {
  const profile = await getCustomerProfile();
  if (!profile) return null;

  const { data, error } = await (supabase as any)
    .from('customer_preferences')
    .select('*')
    .eq('customer_id', profile.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  return data as CustomerPreferences;
};

export const updateCustomerPreferences = async (preferences: Partial<CustomerPreferences>): Promise<CustomerPreferences> => {
  const profile = await getCustomerProfile();
  if (!profile) throw new Error('Profile not found');

  const { data, error } = await (supabase as any)
    .from('customer_preferences')
    .upsert({
      customer_id: profile.id,
      ...preferences,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Log activity
  await supabase.functions.invoke('log-profile-activity', {
    body: {
      customer_id: profile.id,
      action_type: 'preferences_updated'
    }
  });

  return data as CustomerPreferences;
};

// Analytics and Activity
export const getCustomerAnalytics = async (): Promise<CustomerAnalytics> => {
  const profile = await getCustomerProfile();
  if (!profile) throw new Error('Profile not found');

  // Get user email from auth
  const user = (await supabase.auth.getUser()).data.user;
  if (!user?.email) throw new Error('User email not found');

  // Get order analytics
  const { data: analytics } = await (supabase as any)
    .from('customer_purchase_analytics')
    .select('*')
    .eq('customer_email', user.email)
    .single();

  // Get recent orders
  const { data: recentOrders } = await (supabase as any)
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      status,
      order_time,
      order_items (
        quantity,
        price,
        product:products (
          name,
          image_url
        )
      )
    `)
    .eq('customer_email', user.email)
    .order('order_time', { ascending: false })
    .limit(5);

  // Get favorite categories
  const { data: favoriteCategories } = await (supabase as any)
    .from('customer_favorites')
    .select(`
      product:products (
        categories (
          name
        )
      )
    `)
    .eq('customer_id', profile.id);

  // Process favorite categories
  const categoryCount: Record<string, number> = {};
  favoriteCategories?.forEach((fav: any) => {
    const categoryName = fav.product?.categories?.name;
    if (categoryName) {
      categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
    }
  });

  const favoriteCategs = Object.entries(categoryCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalOrders: analytics?.total_orders || 0,
    totalSpent: analytics?.total_spent || 0,
    averageOrderValue: analytics?.average_order_value || 0,
    favoriteCategories: favoriteCategs,
    recentOrders: recentOrders || [],
    memberSince: profile.created_at
  };
};

export const getProfileActivity = async (): Promise<ProfileActivity[]> => {
  const profile = await getCustomerProfile();
  if (!profile) return [];

  const { data, error } = await (supabase as any)
    .from('profile_activity_log')
    .select('*')
    .eq('customer_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data || []) as ProfileActivity[];
};

export const calculateProfileCompletion = async (): Promise<number> => {
  const profile = await getCustomerProfile();
  if (!profile) return 0;

  const { data, error } = await (supabase as any).rpc('calculate_profile_completion', {
    customer_uuid: profile.id
  });

  if (error) throw new Error(error.message);
  return data || 0;
};
