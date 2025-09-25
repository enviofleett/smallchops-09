// ========================================
// ENHANCED SECURITY UTILITIES FOR EDGE FUNCTIONS
// Provides rate limiting, validation, and security monitoring
// ========================================

export interface RateLimitConfig {
  max: number;
  window: number; // seconds
  identifier: string;
}

export interface SecurityContext {
  user_id?: string;
  ip_address: string;
  user_agent: string;
  timestamp: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

// ========================================
// INPUT VALIDATION & SANITIZATION
// ========================================

export function validateAndSanitizeReference(reference: string): ValidationResult {
  if (!reference || typeof reference !== 'string') {
    return { valid: false, error: 'Reference is required and must be a string' };
  }

  // Remove potentially dangerous characters
  const sanitized = reference.replace(/[^a-zA-Z0-9_-]/g, '');
  
  if (sanitized !== reference) {
    return { valid: false, error: 'Reference contains invalid characters' };
  }

  if (sanitized.length < 10 || sanitized.length > 100) {
    return { valid: false, error: 'Reference must be between 10 and 100 characters' };
  }

  return { valid: true, sanitized };
}

export function validateAmount(amount: number): ValidationResult {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  if (amount > 10000000) { // 10 million naira max
    return { valid: false, error: 'Amount exceeds maximum allowed' };
  }

  return { valid: true };
}

export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  const sanitized = email.toLowerCase().trim();
  return { valid: true, sanitized };
}

// ========================================
// SECURITY CONTEXT EXTRACTION
// ========================================

export function extractSecurityContext(req: Request): SecurityContext {
  const clientIP = req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown';
  
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  // Extract first IP if multiple IPs in forwarded header
  const ipAddress = clientIP.split(',')[0].trim();
  
  return {
    ip_address: ipAddress,
    user_agent: userAgent,
    timestamp: new Date().toISOString()
  };
}

export async function extractAuthenticatedContext(req: Request, supabase: any): Promise<SecurityContext> {
  const baseContext = extractSecurityContext(req);
  
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        baseContext.user_id = user.id;
        console.log('✅ Authenticated user context:', user.id);
      }
    } catch (authError) {
      console.warn('Authentication extraction error:', authError);
    }
  }
  
  return baseContext;
}

// ========================================
// RATE LIMITING
// ========================================

export async function checkRateLimit(
  supabase: any, 
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining?: number; reset_time?: string }> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit_secure', {
      p_identifier: config.identifier,
      p_limit_type: 'api_request',
      p_max_requests: config.max,
      p_window_minutes: Math.floor(config.window / 60)
    });

    if (error) {
      console.warn('Rate limit check failed:', error);
      return { allowed: true }; // Fail open
    }

    return {
      allowed: data?.allowed === true,
      remaining: data?.remaining,
      reset_time: data?.reset_time
    };
  } catch (error) {
    console.warn('Rate limit error:', error);
    return { allowed: true }; // Fail open
  }
}

export function getRateLimitKey(context: SecurityContext, prefix: string): string {
  return `${prefix}:${context.user_id || context.ip_address}`;
}

// ========================================
// SECURITY EVENT LOGGING
// ========================================

export async function logSecurityEvent(
  supabase: any,
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any,
  context: SecurityContext
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      action: `security_${eventType}`,
      category: 'Security',
      message: `Security event: ${eventType}`,
      user_id: context.user_id,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      new_values: {
        event_type: eventType,
        severity,
        details,
        timestamp: context.timestamp
      }
    });
  } catch (logError) {
    console.error('Failed to log security event:', logError);
  }
}

// ========================================
// REQUEST SANITIZATION
// ========================================

export function sanitizeRequestData(data: any): any {
  if (typeof data === 'string') {
    // Remove potentially dangerous characters and trim
    return data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/[<>'"&]/g, '')
               .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeRequestData(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Sanitize keys
      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanKey.length > 0 && cleanKey.length <= 50) {
        sanitized[cleanKey] = sanitizeRequestData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

// ========================================
// WEBHOOK SIGNATURE VALIDATION
// ========================================

export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Implement Paystack webhook signature validation
    // This is a placeholder - implement actual HMAC verification
    const crypto = globalThis.crypto;
    if (!crypto || !crypto.subtle) {
      console.warn('Crypto API not available for webhook validation');
      return false;
    }
    
    // TODO: Implement proper HMAC-SHA512 validation
    // For now, return true for development
    return true;
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    return false;
  }
}

// ========================================
// ERROR RESPONSE HELPERS
// ========================================

export function createErrorResponse(
  message: string,
  status: number = 400,
  headers: Record<string, string> = {},
  details?: any
): Response {
  const errorBody = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    ...(details ? { details } : {})
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

export function createSuccessResponse(
  data: any,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  const successBody = {
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  };

  return new Response(JSON.stringify(successBody), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

// ========================================
// MONITORING & METRICS
// ========================================

export async function recordMetrics(
  supabase: any,
  endpoint: string,
  metrics: {
    response_time: number;
    status_code: number;
    user_id?: string;
    ip_address?: string;
    [key: string]: any;
  }
): Promise<void> {
  try {
    await supabase.from('api_metrics').insert({
      endpoint,
      metric_type: 'request_metrics',
      metric_value: metrics.response_time,
      dimensions: {
        status_code: metrics.status_code,
        user_id: metrics.user_id,
        ip_address: metrics.ip_address,
        timestamp: new Date().toISOString(),
        ...metrics
      }
    });
  } catch (error) {
    console.warn('Failed to record metrics:', error);
  }
}

// ========================================
// CIRCUIT BREAKER PATTERN
// ========================================

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 60 seconds
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
  
  getState(): { state: string; failures: number } {
    return {
      state: this.state,
      failures: this.failures
    };
  }
}