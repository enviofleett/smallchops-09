import { supabase } from "@/integrations/supabase/client";

// Define types locally since they're not in generated types
export interface Promotion {
  id: string;
  code: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  start_date: string;
  end_date: string;
  usage_limit?: number;
  usage_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export type NewPromotion = Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'usage_count'>;
export type PromotionStatus = 'active' | 'inactive' | 'expired';
export type PromotionType = 'percentage' | 'fixed';

// Get all promotions
export async function getPromotions(): Promise<Promotion[]> {
  const { data, error } = await (supabase as any)
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}


// Create new promotion
export async function createPromotion(promo: NewPromotion) {
  const { data, error } = await (supabase as any)
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
  const { data, error } = await (supabase as any)
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
  const { error } = await (supabase as any).from("promotions").delete().eq("id", id);
  if (error) throw error;
  return true;
}
