import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Use Supabase generated types
export type Promotion = Database['public']['Tables']['promotions']['Row'];
export type NewPromotion = Database['public']['Tables']['promotions']['Insert'];
export type PromotionStatus = Database['public']['Enums']['promotion_status'];
export type PromotionType = Database['public']['Enums']['promotion_type'];

// Cache for promotions to avoid repeated queries
let promotionsCache: { data: Promotion[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get all promotions with caching and timeout
export async function getPromotions(): Promise<Promotion[]> {
  try {
    // Check cache first
    if (promotionsCache && (Date.now() - promotionsCache.timestamp) < CACHE_DURATION) {
      console.log('Using cached promotions data');
      return promotionsCache.data;
    }

    // Query with timeout protection
    const queryPromise = supabase
      .from("promotions")
      .select("*")
      .order("created_at", { ascending: false });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Promotions query timeout')), 3000)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      console.error('Promotions query error:', error);
      // Return cached data if available, otherwise empty array
      return promotionsCache?.data ?? [];
    }

    const promotions = data ?? [];

    // Update cache
    promotionsCache = {
      data: promotions,
      timestamp: Date.now()
    };

    console.log(`Fetched ${promotions.length} promotions from database`);
    return promotions;

  } catch (error) {
    console.error('Error fetching promotions:', error);

    // Return cached data if available, otherwise empty array
    if (promotionsCache && promotionsCache.data) {
      console.log('Using stale cached promotions due to error');
      return promotionsCache.data;
    }

    // Return empty array as fallback to prevent app breakage
    return [];
  }
}


// Clear promotions cache
export function clearPromotionsCache() {
  promotionsCache = null;
  console.log('Promotions cache cleared');
}

// Create new promotion
export async function createPromotion(promo: NewPromotion) {
  const { data, error } = await supabase
    .from("promotions")
    .insert(promo)
    .select()
    .single();
  if (error) throw error;

  // Clear cache when promotion is created
  clearPromotionsCache();
  return data;
}

// Update promotion
export async function updatePromotion(
  id: string,
  fields: Partial<Promotion>
) {
  const { data, error } = await supabase
    .from("promotions")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  // Clear cache when promotion is updated
  clearPromotionsCache();
  return data;
}

// Delete promotion
export async function deletePromotion(id: string) {
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) throw error;

  // Clear cache when promotion is deleted
  clearPromotionsCache();
  return true;
}
