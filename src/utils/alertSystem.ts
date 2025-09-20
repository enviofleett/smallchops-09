/**
 * Production Alert System with Webhook Integration and Throttling
 */

export interface AlertPayload {
  alertType: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  metadata?: Record<string, any>;
  correlationId?: string;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  retryAttempts?: number;
  timeoutMs?: number;
}

export interface AlertThrottleConfig {
  maxAlertsPerMinute?: number;
  throttleDurationMs?: number;
  dedupWindowMs?: number;
}

class AlertThrottle {
  private alertCounts: Map<string, number> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();
  private throttledUntil: Map<string, number> = new Map();
  
  private maxAlertsPerMinute: number;
  private throttleDurationMs: number;
  private dedupWindowMs: number;

  constructor(config: AlertThrottleConfig = {}) {
    this.maxAlertsPerMinute = config.maxAlertsPerMinute ?? 5;
    this.throttleDurationMs = config.throttleDurationMs ?? 300000; // 5 minutes
    this.dedupWindowMs = config.dedupWindowMs ?? 60000; // 1 minute
  }

  shouldAllowAlert(alertType: string, message: string): boolean {
    const now = Date.now();
    const key = `${alertType}:${message}`;
    
    // Check if throttled
    const throttledUntil = this.throttledUntil.get(alertType);
    if (throttledUntil && now < throttledUntil) {
      console.log(`🚫 Alert throttled: ${alertType} (throttled until ${new Date(throttledUntil).toISOString()})`);
      return false;
    }
    
    // Check deduplication window
    const lastAlertTime = this.lastAlertTimes.get(key);
    if (lastAlertTime && (now - lastAlertTime) < this.dedupWindowMs) {
      console.log(`🚫 Alert deduplicated: ${alertType} (within ${this.dedupWindowMs}ms window)`);
      return false;
    }
    
    // Update counters
    this.lastAlertTimes.set(key, now);
    
    // Check rate limit
    const currentCount = this.alertCounts.get(alertType) ?? 0;
    this.alertCounts.set(alertType, currentCount + 1);
    
    if (currentCount >= this.maxAlertsPerMinute) {
      this.throttledUntil.set(alertType, now + this.throttleDurationMs);
      console.log(`🚫 Alert rate limit exceeded: ${alertType} (${currentCount}/${this.maxAlertsPerMinute})`);
      return false;
    }
    
    // Clean up old counters (older than 1 minute)
    setTimeout(() => {
      const count = this.alertCounts.get(alertType) ?? 0;
      this.alertCounts.set(alertType, Math.max(0, count - 1));
    }, 60000);
    
    return true;
  }

  reset(alertType?: string): void {
    if (alertType) {
      this.alertCounts.delete(alertType);
      this.throttledUntil.delete(alertType);
    } else {
      this.alertCounts.clear();
      this.throttledUntil.clear();
      this.lastAlertTimes.clear();
    }
  }
}

class AlertSystem {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private throttle: AlertThrottle;
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'OrderSystem-AlertBot/1.0'
  };

  constructor() {
    this.throttle = new AlertThrottle();
    
    // Load webhook configurations from environment
    this.loadWebhookConfigs();
  }

  private loadWebhookConfigs(): void {
    // Slack webhook
    const slackWebhook = this.getEnvVar('SLACK_WEBHOOK_URL');
    if (slackWebhook) {
      this.addWebhook('slack', { 
        url: slackWebhook,
        retryAttempts: 3,
        timeoutMs: 5000
      });
    }
    
    // Discord webhook
    const discordWebhook = this.getEnvVar('DISCORD_WEBHOOK_URL');
    if (discordWebhook) {
      this.addWebhook('discord', { 
        url: discordWebhook,
        retryAttempts: 3,
        timeoutMs: 5000
      });
    }
    
    // Generic webhook
    const genericWebhook = this.getEnvVar('ALERT_WEBHOOK_URL');
    if (genericWebhook) {
      this.addWebhook('generic', { 
        url: genericWebhook,
        retryAttempts: 2,
        timeoutMs: 10000
      });
    }
  }

  private getEnvVar(name: string): string | undefined {
    if (typeof globalThis !== 'undefined' && 'Deno' in globalThis) {
      return (globalThis as any).Deno.env.get(name);
    }
    return undefined;
  }

  addWebhook(name: string, config: WebhookConfig): void {
    this.webhooks.set(name, config);
    console.log(`📡 Registered webhook: ${name}`);
  }

  /**
   * Send alert to all configured webhooks
   */
  async sendAlert(payload: AlertPayload): Promise<void> {
    const correlationId = payload.correlationId || `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check throttling
    if (!this.throttle.shouldAllowAlert(payload.alertType, payload.message)) {
      return;
    }
    
    console.log(`🚨 Sending alert [${payload.severity.toUpperCase()}]: ${payload.message} [${correlationId}]`);
    
    // Send to all configured webhooks
    const webhookPromises = Array.from(this.webhooks.entries()).map(([name, config]) =>
      this.sendToWebhook(name, config, payload, correlationId)
    );
    
    try {
      await Promise.allSettled(webhookPromises);
    } catch (error) {
      console.error(`Failed to send alert: ${error.message}`);
    }
  }

  private async sendToWebhook(
    name: string, 
    config: WebhookConfig, 
    payload: AlertPayload, 
    correlationId: string
  ): Promise<void> {
    const maxAttempts = config.retryAttempts ?? 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const webhookPayload = this.formatWebhookPayload(name, payload, correlationId);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs ?? 5000);
        
        const response = await fetch(config.url, {
          method: 'POST',
          headers: { ...this.defaultHeaders, ...config.headers },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.log(`✅ Alert sent to ${name} (attempt ${attempt}/${maxAttempts}) [${correlationId}]`);
        
        // Log successful delivery to database
        await this.logWebhookDelivery({
          webhookUrl: config.url,
          alertType: payload.alertType,
          payload: webhookPayload,
          status: 'delivered',
          responseCode: response.status,
          deliveryAttempts: attempt,
          correlationId
        });
        
        return;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Alert delivery failed to ${name} (attempt ${attempt}/${maxAttempts}): ${error.message} [${correlationId}]`);
        
        if (attempt < maxAttempts) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    // Log failed delivery
    await this.logWebhookDelivery({
      webhookUrl: config.url,
      alertType: payload.alertType,
      payload: this.formatWebhookPayload(name, payload, correlationId),
      status: 'failed',
      responseCode: 0,
      deliveryAttempts: maxAttempts,
      responseBody: lastError?.message,
      correlationId
    });
    
    console.error(`❌ Alert delivery failed to ${name} after ${maxAttempts} attempts [${correlationId}]`);
  }

  private formatWebhookPayload(webhookName: string, payload: AlertPayload, correlationId: string): any {
    const basePayload = {
      ...payload,
      correlationId,
      timestamp: payload.timestamp,
      source: 'OrderSystem'
    };
    
    switch (webhookName) {
      case 'slack':
        return this.formatSlackPayload(payload, correlationId);
      case 'discord':
        return this.formatDiscordPayload(payload, correlationId);
      default:
        return basePayload;
    }
  }

  private formatSlackPayload(payload: AlertPayload, correlationId: string): any {
    const colors = {
      'low': '#36a64f',      // Green
      'medium': '#ff9900',   // Orange  
      'high': '#ff0000',     // Red
      'critical': '#8b0000'  // Dark Red
    };
    
    return {
      username: 'Order System Monitor',
      icon_emoji: ':rotating_light:',
      attachments: [{
        color: colors[payload.severity],
        title: `🚨 ${payload.alertType}`,
        text: payload.message,
        fields: [
          {
            title: 'Severity',
            value: payload.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: new Date(payload.timestamp).toLocaleString(),
            short: true
          },
          {
            title: 'Correlation ID',
            value: correlationId,
            short: true
          }
        ],
        footer: 'Order System Alerts',
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000)
      }]
    };
  }

  private formatDiscordPayload(payload: AlertPayload, correlationId: string): any {
    const colors = {
      'low': 0x36a64f,      // Green
      'medium': 0xff9900,   // Orange  
      'high': 0xff0000,     // Red
      'critical': 0x8b0000  // Dark Red
    };
    
    return {
      username: 'Order System Monitor',
      embeds: [{
        title: `🚨 ${payload.alertType}`,
        description: payload.message,
        color: colors[payload.severity],
        fields: [
          {
            name: 'Severity',
            value: payload.severity.toUpperCase(),
            inline: true
          },
          {
            name: 'Time',
            value: new Date(payload.timestamp).toLocaleString(),
            inline: true
          },
          {
            name: 'Correlation ID',
            value: correlationId,
            inline: true
          }
        ],
        footer: {
          text: 'Order System Alerts'
        },
        timestamp: payload.timestamp
      }]
    };
  }

  private async logWebhookDelivery(data: {
    webhookUrl: string;
    alertType: string;
    payload: any;
    status: string;
    responseCode: number;
    deliveryAttempts: number;
    responseBody?: string;
    correlationId: string;
  }): Promise<void> {
    try {
      // Log to database for monitoring and debugging
      if (typeof fetch !== 'undefined') {
        await fetch('/api/webhook-delivery-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    } catch (error) {
      console.warn('Failed to log webhook delivery:', error.message);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get alert system status and metrics
   */
  getStatus(): any {
    return {
      webhooksConfigured: this.webhooks.size,
      webhooks: Array.from(this.webhooks.keys()),
      throttleActive: this.throttle,
      timestamp: new Date().toISOString()
    };
  }
}

// Global alert system instance
const alertSystem = new AlertSystem();

/**
 * Send an alert with automatic throttling and webhook delivery
 */
export async function sendAlert(
  alertType: string, 
  message: string, 
  severity: AlertPayload['severity'] = 'medium',
  metadata?: Record<string, any>
): Promise<void> {
  const payload: AlertPayload = {
    alertType,
    message,
    severity,
    timestamp: new Date().toISOString(),
    metadata: {
      ...metadata,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'server'
    }
  };
  
  await alertSystem.sendAlert(payload);
}

/**
 * Send critical alert (bypasses some throttling)
 */
export async function sendCriticalAlert(
  alertType: string, 
  message: string, 
  metadata?: Record<string, any>
): Promise<void> {
  return sendAlert(alertType, message, 'critical', metadata);
}

/**
 * Configure webhook for alert delivery
 */
export function addAlertWebhook(name: string, config: WebhookConfig): void {
  alertSystem.addWebhook(name, config);
}

/**
 * Get alert system status
 */
export function getAlertSystemStatus(): any {
  return alertSystem.getStatus();
}

export default alertSystem;