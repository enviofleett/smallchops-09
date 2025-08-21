// ========================================
// 🔗 Paystack Webhook Testing Utility
// Test webhook functionality with simulated Paystack events
// ========================================

export interface WebhookTestEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    customer: {
      email: string;
    };
    channel: string;
    paid_at?: string;
    [key: string]: any;
  };
}

export interface WebhookTestResult {
  event_type: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  response_status?: number;
  response_data?: any;
  duration: number;
  timestamp: string;
}

export interface WebhookTestReport {
  overall_status: 'passed' | 'failed' | 'partial';
  webhook_url: string;
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  results: WebhookTestResult[];
  recommendations: string[];
  timestamp: string;
}

class PaystackWebhookTester {
  private webhookUrl: string;

  constructor() {
    // Determine webhook URL based on environment
    const baseUrl = window.location.hostname.includes('localhost') 
      ? 'http://localhost:8080' 
      : window.location.origin;
    
    this.webhookUrl = `${baseUrl}/functions/v1/enhanced-paystack-webhook`;
  }

  private async sendWebhookEvent(event: WebhookTestEvent): Promise<WebhookTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔗 Sending webhook event: ${event.event}`);
      
      // Create test payload
      const payload = JSON.stringify(event);
      
      // Generate test signature (in real scenario, this would be from Paystack)
      const testSignature = await this.generateTestSignature(payload);
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Paystack-Signature': testSignature,
          'User-Agent': 'PaystackWebhookTester/1.0'
        },
        body: payload
      });

      const duration = Date.now() - startTime;
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      const result: WebhookTestResult = {
        event_type: event.event,
        status: response.ok ? 'passed' : 'failed',
        message: response.ok 
          ? 'Webhook processed successfully' 
          : `Webhook failed with status ${response.status}`,
        response_status: response.status,
        response_data: responseData,
        duration,
        timestamp: new Date().toISOString()
      };

      if (response.ok) {
        console.log(`✅ ${event.event}: PASSED (${duration}ms)`);
      } else {
        console.error(`❌ ${event.event}: FAILED (${duration}ms) - Status: ${response.status}`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        event_type: event.event,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async generateTestSignature(payload: string): Promise<string> {
    // This is a mock signature for testing
    // In production, Paystack generates the real signature
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const keyData = encoder.encode('test_webhook_secret');
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', key, data);
      const hashArray = Array.from(new Uint8Array(signature));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback for environments without crypto.subtle
      return 'test_signature_' + Date.now();
    }
  }

  private createTestEvent(eventType: string, reference: string, amount: number = 50000): WebhookTestEvent {
    const baseEvent: WebhookTestEvent = {
      event: eventType,
      data: {
        reference,
        amount, // in kobo
        currency: 'NGN',
        status: 'success',
        customer: {
          email: 'webhook.test@example.com'
        },
        channel: 'card',
        paid_at: new Date().toISOString()
      }
    };

    // Customize based on event type
    switch (eventType) {
      case 'charge.success':
        baseEvent.data.status = 'success';
        break;
      case 'charge.failed':
        baseEvent.data.status = 'failed';
        break;
      case 'charge.abandoned':
        baseEvent.data.status = 'abandoned';
        break;
    }

    return baseEvent;
  }

  async testChargeSuccessWebhook(reference?: string): Promise<WebhookTestResult> {
    const testReference = reference || `webhook_test_${Date.now()}_success`;
    const event = this.createTestEvent('charge.success', testReference, 50000);
    return await this.sendWebhookEvent(event);
  }

  async testChargeFailedWebhook(reference?: string): Promise<WebhookTestResult> {
    const testReference = reference || `webhook_test_${Date.now()}_failed`;
    const event = this.createTestEvent('charge.failed', testReference, 50000);
    return await this.sendWebhookEvent(event);
  }

  async testChargeAbandonedWebhook(reference?: string): Promise<WebhookTestResult> {
    const testReference = reference || `webhook_test_${Date.now()}_abandoned`;
    const event = this.createTestEvent('charge.abandoned', testReference, 50000);
    return await this.sendWebhookEvent(event);
  }

  async testWebhookConnectivity(): Promise<WebhookTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'OPTIONS'
      });

      const duration = Date.now() - startTime;

      return {
        event_type: 'connectivity_test',
        status: response.status < 500 ? 'passed' : 'failed',
        message: response.status < 500 
          ? 'Webhook endpoint accessible' 
          : `Webhook endpoint not accessible: ${response.status}`,
        response_status: response.status,
        duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        event_type: 'connectivity_test',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Connection failed',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async runCompleteWebhookTest(testReference?: string): Promise<WebhookTestReport> {
    console.log('🔗 Starting complete webhook functionality test...');
    
    const baseReference = testReference || `webhook_complete_test_${Date.now()}`;
    const results: WebhookTestResult[] = [];

    // Test 1: Webhook connectivity
    results.push(await this.testWebhookConnectivity());

    // Test 2: Successful charge webhook
    results.push(await this.testChargeSuccessWebhook(`${baseReference}_success`));

    // Test 3: Failed charge webhook
    results.push(await this.testChargeFailedWebhook(`${baseReference}_failed`));

    // Test 4: Abandoned charge webhook
    results.push(await this.testChargeAbandonedWebhook(`${baseReference}_abandoned`));

    // Generate report
    const passedTests = results.filter(r => r.status === 'passed').length;
    const failedTests = results.filter(r => r.status === 'failed').length;

    let overallStatus: 'passed' | 'failed' | 'partial';
    if (failedTests === 0) {
      overallStatus = 'passed';
    } else if (passedTests > failedTests) {
      overallStatus = 'partial';
    } else {
      overallStatus = 'failed';
    }

    const recommendations = this.generateRecommendations(results);

    const report: WebhookTestReport = {
      overall_status: overallStatus,
      webhook_url: this.webhookUrl,
      tests_run: results.length,
      tests_passed: passedTests,
      tests_failed: failedTests,
      results,
      recommendations,
      timestamp: new Date().toISOString()
    };

    console.log('📊 Webhook test completed:', report);
    return report;
  }

  private generateRecommendations(results: WebhookTestResult[]): string[] {
    const recommendations: string[] = [];
    const failedResults = results.filter(r => r.status === 'failed');

    if (failedResults.length === 0) {
      recommendations.push('✅ All webhook tests passed successfully');
      recommendations.push('🔗 Webhook endpoint is fully functional');
    } else {
      const connectivityFailed = failedResults.some(r => r.event_type === 'connectivity_test');
      const webhookProcessingFailed = failedResults.some(r => r.event_type.includes('charge'));

      if (connectivityFailed) {
        recommendations.push('❌ Webhook endpoint not accessible - check deployment');
        recommendations.push('🔧 Verify edge function is deployed and URL is correct');
      }

      if (webhookProcessingFailed) {
        recommendations.push('⚠️ Webhook processing errors detected');
        recommendations.push('📋 Check webhook handler for order lookup and processing logic');
        recommendations.push('🔍 Verify Paystack IP whitelisting and signature validation');
      }

      failedResults.forEach(result => {
        if (result.response_status === 401) {
          recommendations.push('🔐 Check Paystack signature validation and IP whitelisting');
        } else if (result.response_status === 404) {
          recommendations.push('🎯 Webhook endpoint not found - verify URL configuration');
        } else if (result.response_status === 500) {
          recommendations.push('💥 Internal server error in webhook handler - check logs');
        }
      });
    }

    return recommendations;
  }

  // Helper method to test with real order
  async testWebhookWithRealOrder(orderId: string, reference: string): Promise<WebhookTestResult> {
    console.log(`🎯 Testing webhook with real order: ${orderId}`);
    
    const event = this.createTestEvent('charge.success', reference, 50000);
    
    // Add order-specific metadata
    event.data.metadata = {
      order_id: orderId,
      test: true
    };

    return await this.sendWebhookEvent(event);
  }
}

// Export singleton instance
export const paystackWebhookTester = new PaystackWebhookTester();

// Helper functions
export async function quickWebhookTest() {
  return await paystackWebhookTester.testWebhookConnectivity();
}

export async function testSuccessWebhook(reference?: string) {
  return await paystackWebhookTester.testChargeSuccessWebhook(reference);
}

export async function runFullWebhookTest(reference?: string) {
  return await paystackWebhookTester.runCompleteWebhookTest(reference);
}
