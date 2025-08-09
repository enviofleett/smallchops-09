import { supabase } from "@/integrations/supabase/client";

/**
 * Run batch verification from console or a temporary admin tool.
 * Example usage:
 *   import { runPaystackBatchVerify } from "@/utils/paystackBatchVerify";
 *   runPaystackBatchVerify({ excludeOrderNumbers: ["ORD-20250808-6181"], limit: 200 }).then(console.log);
 */
export async function runPaystackBatchVerify(params?: {
  excludeOrderNumbers?: string[];
  limit?: number;
  dryRun?: boolean;
}) {
  const { data, error } = await supabase.functions.invoke("paystack-batch-verify", {
    body: {
      excludeOrderNumbers: params?.excludeOrderNumbers ?? ["ORD-20250808-6181"],
      limit: params?.limit ?? 200,
      dryRun: params?.dryRun ?? false,
    },
  });

  if (error) return { error: error.message };
  return data;
}
