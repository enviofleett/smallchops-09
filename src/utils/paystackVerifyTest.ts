
/**
 * Simple test helper to call the paystack-verify function directly via fetch.
 * Usage in console or code:
 *   import { verifyPaystackTransaction } from '@/utils/paystackVerifyTest';
 *   verifyPaystackTransaction('your_reference_here').then(console.log);
 */
export async function verifyPaystackTransaction(reference: string) {
  const endpoint = 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-secure';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', reference }),
    });
    const json = await res.json();
    if (!res.ok) {
      // Normalize error output
      return { error: json?.error || `HTTP ${res.status}` };
    }
    return json;
  } catch (e: any) {
    return { error: e?.message || 'Network error' };
  }
}
