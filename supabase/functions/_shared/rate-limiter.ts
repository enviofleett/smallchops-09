// CRITICAL SECURITY: Distributed Rate Limiting System
// Prevents payment abuse and API flooding attacks

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // seconds until next request allowed
  remaining?: number; // requests remaining in window
  resetTime?: Date; // when the rate limit window resets
}

interface RateLimitConfig {
  windowMs: number; // time window in milliseconds
  maxRequests: number; // maximum requests per window
  identifier: string; // unique identifier (IP, user ID, etc.)
  operation: string; // operation type (payment, verification, etc.)
}

export class DistributedRateLimiter {
  
  // CRITICAL: Check and enforce rate limits
  static async checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      const window = Math.floor(Date.now() / config.windowMs);
      const key = `${config.operation}:${config.identifier}:${window}`;
      const windowEnd = new Date((window + 1) * config.windowMs);
      
      console.log(`[RATE_LIMIT] Checking ${config.operation} for ${config.identifier}`);

      // Get current count for this window
      const { data: currentLimit, error: selectError } = await supabase
        .from('enhanced_rate_limits')
        .select('request_count')
        .eq('key', key)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('[RATE_LIMIT] Error checking rate limit:', selectError);
        // Fail open but log the error
        return { allowed: true };
      }

      const currentCount = currentLimit?.request_count || 0;

      // Check if limit exceeded
      if (currentCount >= config.maxRequests) {
        const retryAfter = Math.ceil((windowEnd.getTime() - Date.now()) / 1000);
        
        console.log(`[RATE_LIMIT] Rate limit exceeded for ${config.identifier}: ${currentCount}/${config.maxRequests}`);
        
        // Log rate limit incident
        await supabase.from('security_incidents').insert({
          type: 'rate_limit_exceeded',
          description: `Rate limit exceeded for ${config.operation}`,
          severity: 'medium',
          request_data: {
            operation: config.operation,
            identifier: config.identifier,
            current_count: currentCount,
            max_requests: config.maxRequests,
            window_ms: config.windowMs
          }
        });

        return { 
          allowed: false, 
          retryAfter,
          remaining: 0,
          resetTime: windowEnd
        };
      }

      // Increment counter atomically
      const { error: upsertError } = await supabase
        .from('enhanced_rate_limits')
        .upsert({
          key,
          request_count: currentCount + 1,
          window_start: new Date(window * config.windowMs),
          window_end: windowEnd
        });

      if (upsertError) {
        console.error('[RATE_LIMIT] Error updating rate limit:', upsertError);
        // Fail open but log the error
        return { allowed: true };
      }

      const remaining = Math.max(0, config.maxRequests - (currentCount + 1));
      
      console.log(`[RATE_LIMIT] Request allowed: ${currentCount + 1}/${config.maxRequests} remaining: ${remaining}`);

      return { 
        allowed: true,
        remaining,
        resetTime: windowEnd
      };

    } catch (error) {
      console.error('[RATE_LIMIT] Rate limiting error:', error);
      // Fail open to prevent blocking legitimate requests during errors
      return { allowed: true };
    }
  }

  // CRITICAL: Payment-specific rate limiting
  static async checkPaymentRateLimit(identifier: string, operationType: 'initialize' | 'verify' | 'webhook' = 'initialize'): Promise<RateLimitResult> {
    const configs = {
      initialize: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10, // 10 payment initializations per minute
        identifier,
        operation: 'payment_initialize'
      },
      verify: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30, // 30 verifications per minute
        identifier,
        operation: 'payment_verify'
      },
      webhook: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100, // 100 webhook events per minute
        identifier,
        operation: 'webhook_process'
      }
    };

    return this.checkRateLimit(configs[operationType]);
  }

  // CRITICAL: IP-based rate limiting for suspicious activity
  static async checkIPRateLimit(ipAddress: string, operationType: string = 'general'): Promise<RateLimitResult> {
    // More restrictive limits for IP-based rate limiting
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // 50 requests per 15 minutes per IP
      identifier: ipAddress,
      operation: `ip_${operationType}`
    };

    return this.checkRateLimit(config);
  }

  // CRITICAL: User-based rate limiting
  static async checkUserRateLimit(userId: string, operationType: string = 'general'): Promise<RateLimitResult> {
    const config: RateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20, // 20 requests per minute per user
      identifier: userId,
      operation: `user_${operationType}`
    };

    return this.checkRateLimit(config);
  }

  // CRITICAL: Global rate limiting for system protection
  static async checkGlobalRateLimit(operationType: string = 'global'): Promise<RateLimitResult> {
    const config: RateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1000, // 1000 requests per minute globally
      identifier: 'GLOBAL',
      operation: `global_${operationType}`
    };

    return this.checkRateLimit(config);
  }

  // CRITICAL: Clean up expired rate limit entries
  static async cleanupExpiredLimits(): Promise<{ deleted: number }> {
    try {
      const { error, count } = await supabase
        .from('enhanced_rate_limits')
        .delete()
        .lt('window_end', new Date().toISOString());

      if (error) {
        console.error('[RATE_LIMIT] Cleanup error:', error);
        return { deleted: 0 };
      }

      console.log(`[RATE_LIMIT] Cleaned up ${count || 0} expired rate limit entries`);
      return { deleted: count || 0 };

    } catch (error) {
      console.error('[RATE_LIMIT] Cleanup exception:', error);
      return { deleted: 0 };
    }
  }

  // CRITICAL: Get rate limit status for monitoring
  static async getRateLimitStatus(identifier: string, operation: string): Promise<{
    current: number;
    limit: number;
    resetTime: Date | null;
    remaining: number;
  }> {
    try {
      // Get the most recent window for this identifier and operation
      const { data, error } = await supabase
        .from('enhanced_rate_limits')
        .select('*')
        .like('key', `${operation}:${identifier}:%`)
        .order('window_end', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return {
          current: 0,
          limit: 0,
          resetTime: null,
          remaining: 0
        };
      }

      const current = data.request_count;
      const limit = 20; // Default limit, should be configurable
      const resetTime = new Date(data.window_end);
      const remaining = Math.max(0, limit - current);

      return {
        current,
        limit,
        resetTime,
        remaining
      };

    } catch (error) {
      console.error('[RATE_LIMIT] Status check error:', error);
      return {
        current: 0,
        limit: 0,
        resetTime: null,
        remaining: 0
      };
    }
  }

  // CRITICAL: Block suspicious IPs temporarily
  static async blockSuspiciousIP(ipAddress: string, reason: string, durationMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const blockUntil = new Date(Date.now() + durationMs);

      // Create a very restrictive rate limit for this IP
      const blockKey = `block:${ipAddress}:${Date.now()}`;
      
      await supabase
        .from('enhanced_rate_limits')
        .insert({
          key: blockKey,
          request_count: 999999, // Effectively blocked
          window_start: new Date(),
          window_end: blockUntil
        });

      // Log the block
      await supabase.from('security_incidents').insert({
        type: 'ip_blocked',
        description: `IP address blocked for suspicious activity: ${reason}`,
        severity: 'high',
        ip_address: ipAddress,
        request_data: {
          reason,
          duration_ms: durationMs,
          block_until: blockUntil.toISOString()
        }
      });

      console.log(`[RATE_LIMIT] Blocked IP ${ipAddress} until ${blockUntil.toISOString()} for: ${reason}`);

    } catch (error) {
      console.error('[RATE_LIMIT] Error blocking IP:', error);
    }
  }

  // CRITICAL: Check if IP is currently blocked
  static async isIPBlocked(ipAddress: string): Promise<{ blocked: boolean; reason?: string; unblockTime?: Date }> {
    try {
      const { data, error } = await supabase
        .from('enhanced_rate_limits')
        .select('*')
        .like('key', `block:${ipAddress}:%`)
        .gt('window_end', new Date().toISOString())
        .order('window_end', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return { blocked: false };
      }

      // Check if the block is still active
      const unblockTime = new Date(data.window_end);
      const isBlocked = unblockTime > new Date();

      return {
        blocked: isBlocked,
        reason: 'IP temporarily blocked for suspicious activity',
        unblockTime: isBlocked ? unblockTime : undefined
      };

    } catch (error) {
      console.error('[RATE_LIMIT] Error checking IP block status:', error);
      return { blocked: false };
    }
  }
}