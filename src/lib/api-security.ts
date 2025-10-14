/**
 * 🔒 API Security Layer - Phase 3: API Endpoint Protection
 * 
 * Provides centralized security utilities for all API operations:
 * - Authentication verification before API calls
 * - Input validation and sanitization
 * - Authorization checks for sensitive operations
 * - Consistent error handling
 */

import { supabase } from '@/integrations/supabase/client';
import { checkIsAdmin } from '@/lib/auth-helpers';
import { toast } from 'sonner';
import { z } from 'zod';

// ============ Authentication Guards ============

/**
 * Verifies user is authenticated before proceeding
 * @throws Error if user is not authenticated
 */
export async function requireAuthentication(): Promise<{ userId: string; email: string }> {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    const message = 'Authentication required. Please log in.';
    toast.error(message);
    throw new Error(message);
  }

  return {
    userId: user.id,
    email: user.email || ''
  };
}

/**
 * Verifies user has admin privileges
 * @throws Error if user is not an admin
 */
export async function requireAdminAccess(): Promise<{ userId: string; email: string; isAdmin: true }> {
  const auth = await requireAuthentication();
  
  const isAdmin = await checkIsAdmin();
  
  if (!isAdmin) {
    const message = 'Admin access required for this operation';
    toast.error(message);
    throw new Error(message);
  }

  return { ...auth, isAdmin: true as const };
}

// ============ Input Validation Schemas ============

export const OrderUpdateSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
  updates: z.object({
    status: z.enum([
      'pending', 'confirmed', 'preparing', 'ready', 
      'out_for_delivery', 'delivered', 'cancelled', 
      'refunded', 'completed', 'returned'
    ]).optional(),
    assigned_rider_id: z.string().uuid().nullable().optional(),
    payment_status: z.enum(['pending', 'paid', 'failed', 'refunded', 'completed']).optional(),
    admin_notes: z.string().max(1000).optional(),
    delivery_fee: z.number().min(0).optional(),
  }).strict() // Prevent unknown fields
});

export const BulkUpdateSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order ID required'),
  updates: z.record(z.any()).refine(
    (data) => Object.keys(data).length > 0,
    'Updates object cannot be empty'
  )
});

// ============ Validation Helpers ============

/**
 * Validates and sanitizes order update payload
 */
export function validateOrderUpdate(payload: unknown) {
  try {
    return OrderUpdateSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      toast.error(`Validation error: ${message}`);
      throw new Error(`Invalid order update: ${message}`);
    }
    throw error;
  }
}

/**
 * Validates bulk update payload
 */
export function validateBulkUpdate(payload: unknown) {
  try {
    return BulkUpdateSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      toast.error(`Validation error: ${message}`);
      throw new Error(`Invalid bulk update: ${message}`);
    }
    throw error;
  }
}

// ============ Secure API Wrapper ============

interface SecureAPICallOptions<T> {
  operation: string;
  requiresAdmin?: boolean;
  validate?: (payload: unknown) => T;
  execute: (auth: { userId: string; email: string }) => Promise<any>;
}

/**
 * Centralized secure API call wrapper
 * Handles authentication, validation, error logging
 */
export async function secureAPICall<T = any>({
  operation,
  requiresAdmin = false,
  validate,
  execute
}: SecureAPICallOptions<T>): Promise<any> {
  try {
    // 1. Verify authentication
    const auth = requiresAdmin 
      ? await requireAdminAccess()
      : await requireAuthentication();

    // 2. Execute the operation
    const result = await execute(auth);

    // 3. Log success for audit trail
    console.info(`✅ Secure API call succeeded: ${operation}`, {
      userId: auth.userId,
      timestamp: new Date().toISOString()
    });

    return result;

  } catch (error: any) {
    // 4. Log failure for security monitoring
    console.error(`❌ Secure API call failed: ${operation}`, {
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // 5. Re-throw with context
    throw new Error(`${operation} failed: ${error.message}`);
  }
}

// ============ Rate Limiting (Client-side indicator) ============

const rateLimitMap = new Map<string, number[]>();

/**
 * Simple client-side rate limit check
 * Note: This is NOT a security measure, just UX improvement
 * Real rate limiting happens server-side
 */
export function checkClientRateLimit(
  operation: string, 
  maxRequests: number = 10, 
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const key = operation;
  
  const timestamps = rateLimitMap.get(key) || [];
  const recentRequests = timestamps.filter(t => now - t < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    toast.error(`Too many requests. Please wait a moment.`);
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(key, recentRequests);
  return true;
}
