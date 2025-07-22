import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Use Supabase generated types
export type Promotion = Database['public']['Tables']['promotions']['Row'];
export type NewPromotion = Database['public']['Tables']['promotions']['Insert'];
export type PromotionStatus = Database['public']['Enums']['promotion_status'];
export type PromotionType = Database['public']['Enums']['promotion_type'];

// Get all promotions
export async function getPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}


// Create new promotion
export async function createPromotion(promo: NewPromotion) {
  const { data, error } = await supabase
    .from("promotions")
    .insert(promo)
    .select()
    .single();
  if (error) throw error;
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
  return data;
}

// Delete promotion
export async function deletePromotion(id: string) {
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) throw error;
  return true;
}
