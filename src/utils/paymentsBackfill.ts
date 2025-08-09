import { supabase } from '@/integrations/supabase/client';

/**
 * Run this from anywhere (e.g., a temporary admin dev tool or browser console):
 *   import { backfillPaystackRefs } from '@/utils/paymentsBackfill';
 *   backfillPaystackRefs(['ref1','ref2']).then(console.log)
 */
export async function backfillPaystackRefs(refs: string[]) {
  const results: Array<{ reference: string; ok: boolean; message?: string }> = [];
  for (const reference of refs) {
    try {
      // Prefer enhanced function
      const { data, error } = await supabase.functions.invoke('paystack-verify', {
        body: { reference }
      });
      if (error) throw new Error(error.message);

      if (data?.success || data?.status === true) {
        results.push({ reference, ok: true });
        continue;
      }

      // Fallback to legacy
      const fb = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference }
      });
      if (fb.error) throw new Error(fb.error.message);
      const ok = fb.data?.success || fb.data?.status === true || fb.data?.data?.status === 'success';
      results.push({ reference, ok, message: ok ? undefined : (fb.data?.message || fb.data?.error || 'failed') });
    } catch (e: any) {
      results.push({ reference, ok: false, message: e?.message || 'error' });
    }
  }
  return results;
}
