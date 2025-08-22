// Enhanced Email Rate Limiting System
// Prevents email abuse and maintains sender reputation

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

interface EmailRateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // seconds until next email allowed
  dailyRemaining?: number;
  hourlyRemaining?: number;
  resetTime?: Date;
}

interface EmailRateLimitConfig {
  recipient: string;
  emailType: 'transactional' | 'marketing' | 'notification' | 'system';
  senderIp?: string;
  templateKey?: string;
}

export class EmailRateLimiter {
  
  // Rate limit configurations for different email types
  private static readonly LIMITS = {
    transactional: {
      perHour: 50,    // High limit for important emails
      perDay: 200,
      perWeek: 500
    },
    marketing: {
      perHour: 5,     // Lower limit for marketing
      perDay: 10,
      perWeek: 20
    },
    notification: {
      perHour: 20,    // Medium limit for notifications
      perDay: 100,
      perWeek: 300
    },
    system: {
      perHour: 100,   // High limit for system emails
      perDay: 500,
      perWeek: 1000
    }
  };

  // Global limits to prevent abuse
  private static readonly GLOBAL_LIMITS = {
    perMinute: 30,    // Total emails per minute across all types
    perHour: 1000,    // Total emails per hour
    perDay: 5000      // Total emails per day
  };

  static async checkEmailRateLimit(config: EmailRateLimitConfig): Promise<EmailRateLimitResult> {
    try {
      const { recipient, emailType, senderIp, templateKey } = config;
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      console.log(`[EMAIL_RATE_LIMIT] Checking limits for ${recipient} (${emailType})`);

      // Get email type limits
      const limits = this.LIMITS[emailType] || this.LIMITS.transactional;

      // 1. Check recipient-specific limits
      const { data: recentEmails, error: emailError } = await supabase
        .from('email_delivery_logs')
        .select('created_at, email_type, delivery_status')
        .eq('recipient_email', recipient)
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false });

      if (emailError) {
        console.error('[EMAIL_RATE_LIMIT] Error checking email history:', emailError);
        // Fail open but log the error
        return { allowed: true };
      }

      // Count emails by time period
      const hourlyCount = recentEmails?.filter(e => 
        new Date(e.created_at) >= hourAgo && e.email_type === emailType
      ).length || 0;

      const dailyCount = recentEmails?.filter(e => 
        new Date(e.created_at) >= dayAgo && e.email_type === emailType
      ).length || 0;

      const weeklyCount = recentEmails?.filter(e => 
        new Date(e.created_at) >= weekAgo && e.email_type === emailType
      ).length || 0;

      // Check specific limits
      if (hourlyCount >= limits.perHour) {
        const nextHour = new Date(Math.ceil(now.getTime() / (60 * 60 * 1000)) * 60 * 60 * 1000);
        return {
          allowed: false,
          reason: `Hourly limit exceeded for ${emailType} emails (${hourlyCount}/${limits.perHour})`,
          retryAfter: Math.ceil((nextHour.getTime() - now.getTime()) / 1000),
          hourlyRemaining: 0,
          dailyRemaining: Math.max(0, limits.perDay - dailyCount),
          resetTime: nextHour
        };
      }

      if (dailyCount >= limits.perDay) {
        const nextDay = new Date(Math.ceil(now.getTime() / (24 * 60 * 60 * 1000)) * 24 * 60 * 60 * 1000);
        return {
          allowed: false,
          reason: `Daily limit exceeded for ${emailType} emails (${dailyCount}/${limits.perDay})`,
          retryAfter: Math.ceil((nextDay.getTime() - now.getTime()) / 1000),
          hourlyRemaining: Math.max(0, limits.perHour - hourlyCount),
          dailyRemaining: 0,
          resetTime: nextDay
        };
      }

      if (weeklyCount >= limits.perWeek) {
        return {
          allowed: false,
          reason: `Weekly limit exceeded for ${emailType} emails (${weeklyCount}/${limits.perWeek})`,
          retryAfter: 24 * 60 * 60, // Try again tomorrow
          hourlyRemaining: Math.max(0, limits.perHour - hourlyCount),
          dailyRemaining: Math.max(0, limits.perDay - dailyCount)
        };
      }

      // 2. Check global system limits
      const { data: globalEmails, error: globalError } = await supabase
        .from('email_delivery_logs')
        .select('created_at')
        .gte('created_at', dayAgo.toISOString());

      if (!globalError && globalEmails) {
        const minuteAgo = new Date(now.getTime() - 60 * 1000);
        
        const globalMinuteCount = globalEmails.filter(e => 
          new Date(e.created_at) >= minuteAgo
        ).length;

        const globalHourlyCount = globalEmails.filter(e => 
          new Date(e.created_at) >= hourAgo
        ).length;

        const globalDailyCount = globalEmails.length;

        if (globalMinuteCount >= this.GLOBAL_LIMITS.perMinute) {
          return {
            allowed: false,
            reason: `Global rate limit exceeded: ${globalMinuteCount}/${this.GLOBAL_LIMITS.perMinute} emails per minute`,
            retryAfter: 60,
            hourlyRemaining: Math.max(0, limits.perHour - hourlyCount),
            dailyRemaining: Math.max(0, limits.perDay - dailyCount)
          };
        }

        if (globalHourlyCount >= this.GLOBAL_LIMITS.perHour) {
          return {
            allowed: false,
            reason: `Global hourly limit exceeded: ${globalHourlyCount}/${this.GLOBAL_LIMITS.perHour} emails`,
            retryAfter: 60 * 60,
            hourlyRemaining: 0,
            dailyRemaining: Math.max(0, limits.perDay - dailyCount)
          };
        }

        if (globalDailyCount >= this.GLOBAL_LIMITS.perDay) {
          return {
            allowed: false,
            reason: `Global daily limit exceeded: ${globalDailyCount}/${this.GLOBAL_LIMITS.perDay} emails`,
            retryAfter: 24 * 60 * 60,
            hourlyRemaining: 0,
            dailyRemaining: 0
          };
        }
      }

      // 3. Check for suspicious patterns
      if (recentEmails && recentEmails.length > 0) {
        // Check for rapid-fire emails (more than 5 in last 5 minutes)
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const rapidFireCount = recentEmails.filter(e => 
          new Date(e.created_at) >= fiveMinutesAgo
        ).length;

        if (rapidFireCount >= 5) {
          return {
            allowed: false,
            reason: `Rapid-fire email detection: ${rapidFireCount} emails in 5 minutes`,
            retryAfter: 5 * 60,
            hourlyRemaining: Math.max(0, limits.perHour - hourlyCount),
            dailyRemaining: Math.max(0, limits.perDay - dailyCount)
          };
        }

        // Check for duplicate template sends (same template within 10 minutes)
        if (templateKey) {
          const { data: duplicateCheck } = await supabase
            .from('email_delivery_logs')
            .select('created_at')
            .eq('recipient_email', recipient)
            .eq('template_key', templateKey)
            .gte('created_at', new Date(now.getTime() - 10 * 60 * 1000).toISOString())
            .limit(1);

          if (duplicateCheck && duplicateCheck.length > 0) {
            return {
              allowed: false,
              reason: `Duplicate template email prevented: ${templateKey} sent within 10 minutes`,
              retryAfter: 10 * 60,
              hourlyRemaining: Math.max(0, limits.perHour - hourlyCount),
              dailyRemaining: Math.max(0, limits.perDay - dailyCount)
            };
          }
        }
      }

      // 4. Check IP-based limits if provided
      if (senderIp) {
        const { data: ipEmails } = await supabase
          .from('email_delivery_logs')
          .select('created_at')
          .eq('sender_ip', senderIp)
          .gte('created_at', hourAgo.toISOString());

        if (ipEmails && ipEmails.length >= 100) { // 100 emails per hour per IP
          return {
            allowed: false,
            reason: `IP rate limit exceeded: ${ipEmails.length}/100 emails per hour`,
            retryAfter: 60 * 60,
            hourlyRemaining: Math.max(0, limits.perHour - hourlyCount),
            dailyRemaining: Math.max(0, limits.perDay - dailyCount)
          };
        }
      }

      // All checks passed
      console.log(`[EMAIL_RATE_LIMIT] Rate limit passed for ${recipient} (${emailType})`);
      return {
        allowed: true,
        hourlyRemaining: Math.max(0, limits.perHour - hourlyCount),
        dailyRemaining: Math.max(0, limits.perDay - dailyCount)
      };

    } catch (error) {
      console.error('[EMAIL_RATE_LIMIT] Error in rate limit check:', error);
      // Fail open in case of system errors to prevent blocking critical emails
      return { allowed: true };
    }
  }

  // Check if recipient is suppressed (bounced, complained, etc.)
  static async checkEmailSuppression(recipient: string): Promise<{ suppressed: boolean; reason?: string }> {
    try {
      // Check email suppression/bounce list
      const { data: suppressionData, error } = await supabase
        .from('email_suppression_list')
        .select('reason, suppressed_at, suppression_type')
        .eq('email_address', recipient)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[EMAIL_SUPPRESSION] Error checking suppression:', error);
        return { suppressed: false };
      }

      if (suppressionData) {
        return {
          suppressed: true,
          reason: `Email suppressed: ${suppressionData.reason} (${suppressionData.suppression_type})`
        };
      }

      // Check recent bounces
      const { data: bounceData } = await supabase
        .from('email_delivery_logs')
        .select('delivery_status, smtp_response, created_at')
        .eq('recipient_email', recipient)
        .eq('delivery_status', 'bounced')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (bounceData && bounceData.length > 0) {
        const recentBounce = bounceData[0];
        return {
          suppressed: true,
          reason: `Recent bounce detected: ${recentBounce.smtp_response}`
        };
      }

      return { suppressed: false };

    } catch (error) {
      console.error('[EMAIL_SUPPRESSION] Error checking email suppression:', error);
      return { suppressed: false };
    }
  }

  // Get rate limit status for a recipient
  static async getRateLimitStatus(recipient: string): Promise<{
    transactional: EmailRateLimitResult;
    marketing: EmailRateLimitResult;
    notification: EmailRateLimitResult;
  }> {
    const [transactional, marketing, notification] = await Promise.all([
      this.checkEmailRateLimit({ recipient, emailType: 'transactional' }),
      this.checkEmailRateLimit({ recipient, emailType: 'marketing' }),
      this.checkEmailRateLimit({ recipient, emailType: 'notification' })
    ]);

    return { transactional, marketing, notification };
  }
}