import { supabase } from "@/integrations/supabase/client";

// Types matching the database enums
export type PromotionStatus = "active" | "paused" | "expired";
type PromotionType = "discount" | "loyalty" | "referral" | "bundle" | "flash_sale";
type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: PromotionType;
  discount_percent: number | null;
  discount_amount: number | null;
  min_purchase: number | null;
  loyalty_points_reward: number | null;
  referral_reward_amount: number | null;
  tier_required: LoyaltyTier | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  status: PromotionStatus;
  created_at: string;
  updated_at: string;
}

// Get all promotions
export async function getPromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Util to properly cast tier/status fields to accepted types
function castPromotionInput(input: any): Omit<Promotion, "id" | "created_at" | "updated_at" | "status"> & {
  tier_required?: LoyaltyTier | null;
} {
  const newInput = { ...input };

  // Only restrict to allowed enums if a value is present
  if ("tier_required" in newInput && newInput.tier_required != null) {
    const tiers: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum"];
    newInput.tier_required = tiers.includes(newInput.tier_required) ? newInput.tier_required : null;
  } else {
    newInput.tier_required = null;
  }

  if ("type" in newInput && newInput.type) {
    const allowedTypes: PromotionType[] = ["discount", "loyalty", "referral", "bundle", "flash_sale"];
    newInput.type = allowedTypes.includes(newInput.type) ? newInput.type : "discount";
  }

  return newInput;
}

// Create new promotion
export async function createPromotion(
  promo: Omit<Promotion, "id" | "created_at" | "updated_at" | "status">
) {
  const insertPromo = castPromotionInput(promo);

  const { data, error } = await supabase
    .from("promotions")
    .insert(insertPromo)
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
  const updateFields = { ...fields };

  // Only restrict to allowed enums if value present
  if ("tier_required" in updateFields && updateFields.tier_required != null) {
    const tiers: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum"];
    updateFields.tier_required = tiers.includes(updateFields.tier_required as LoyaltyTier)
      ? updateFields.tier_required as LoyaltyTier
      : null;
  } else if ("tier_required" in updateFields) {
    updateFields.tier_required = null;
  }

  if ("status" in updateFields && updateFields.status != null) {
    const statuses: PromotionStatus[] = ["active", "paused", "expired"];
    updateFields.status = statuses.includes(updateFields.status as PromotionStatus)
      ? updateFields.status as PromotionStatus
      : "active";
  } else if ("status" in updateFields) {
    updateFields.status = "active";
  }

  if ("type" in updateFields && updateFields.type != null) {
    const allowedTypes: PromotionType[] = ["discount", "loyalty", "referral", "bundle", "flash_sale"];
    updateFields.type = allowedTypes.includes(updateFields.type as PromotionType)
      ? updateFields.type as PromotionType
      : "discount";
  }

  const { data, error } = await supabase
    .from("promotions")
    .update(updateFields)
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
