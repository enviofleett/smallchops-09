// Phase 5.1: Comprehensive Testing Utilities
import { supabase } from '@/integrations/supabase/client';

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  type: 'concurrent' | 'lifecycle' | 'stress' | 'edge_case';
  status: 'pending' | 'running' | 'passed' | 'failed';
  results?: TestResults;
  startedAt?: string;
  completedAt?: string;
}

export interface TestResults {
  duration: number;
  success: boolean;
  operations: number;
  errors: string[];
  metrics: {
    responseTime: number;
    conflictRate: number;
    errorRate: number;
    throughput: number;
  };
}

export interface ConcurrentTestConfig {
  adminCount: number;
  operationsPerAdmin: number;
  targetOrderId: string;
  delayBetweenOperations: number;
}

export class OrderTestingSuite {
  private static testSessions: Map<string, AbortController> = new Map();

  // 5.1.1 Multi-admin Concurrent Session Testing
  static async runConcurrentAdminTest(config: ConcurrentTestConfig): Promise<TestResults> {
    const testId = `concurrent_${Date.now()}`;
    const controller = new AbortController();
    this.testSessions.set(testId, controller);

    const startTime = Date.now();
    const operations: Promise<any>[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let conflictCount = 0;

    try {
      console.log(`🧪 Starting concurrent test with ${config.adminCount} admins, ${config.operationsPerAdmin} ops each`);

      // Create concurrent admin sessions
      for (let adminIndex = 0; adminIndex < config.adminCount; adminIndex++) {
        const adminSessionId = `test_admin_${adminIndex}_${Date.now()}`;
        
        for (let opIndex = 0; opIndex < config.operationsPerAdmin; opIndex++) {
          const operation = this.simulateAdminOperation(
            config.targetOrderId,
            adminSessionId,
            opIndex,
            config.delayBetweenOperations,
            controller.signal
          );
          
          operations.push(
            operation.then(result => {
              if (result.success) successCount++;
              if (result.conflict) conflictCount++;
              return result;
            }).catch(error => {
              errors.push(`Admin ${adminIndex} Op ${opIndex}: ${error.message}`);
              return { success: false, conflict: false, error: error.message };
            })
          );
        }
      }

      // Wait for all operations to complete
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - startTime;

      // Calculate metrics
      const totalOperations = operations.length;
      const errorRate = errors.length / totalOperations;
      const conflictRate = conflictCount / totalOperations;
      const throughput = totalOperations / (duration / 1000);

      return {
        duration,
        success: errors.length === 0,
        operations: totalOperations,
        errors,
        metrics: {
          responseTime: duration / totalOperations,
          conflictRate,
          errorRate,
          throughput
        }
      };

    } finally {
      this.testSessions.delete(testId);
    }
  }

  // 5.1.2 Full Order Lifecycle Simulation
  static async runOrderLifecycleTest(orderId?: string): Promise<TestResults> {
    const startTime = Date.now();
    const errors: string[] = [];
    const lifecycle = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed'];
    
    try {
      console.log('🔄 Starting order lifecycle test');
      
      // Create test order if none provided
      const testOrderId = orderId || await this.createTestOrder();
      
      let currentStatus = 'pending';
      for (const nextStatus of lifecycle) {
        const stepStart = Date.now();
        
        try {
          const response = await supabase.functions.invoke('admin-orders-manager', {
            body: {
              action: 'update_status',
              orderId: testOrderId,
              newStatus: nextStatus,
              adminSessionId: `lifecycle_test_${Date.now()}`
            }
          });

          if (response.error) {
            errors.push(`${currentStatus} → ${nextStatus}: ${response.error.message}`);
          } else {
            const stepDuration = Date.now() - stepStart;
            console.log(`✅ ${currentStatus} → ${nextStatus} (${stepDuration}ms)`);
            currentStatus = nextStatus;
          }
        } catch (error) {
          errors.push(`${currentStatus} → ${nextStatus}: ${error.message}`);
        }

        // Small delay between transitions
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const duration = Date.now() - startTime;
      return {
        duration,
        success: errors.length === 0,
        operations: lifecycle.length,
        errors,
        metrics: {
          responseTime: duration / lifecycle.length,
          conflictRate: 0,
          errorRate: errors.length / lifecycle.length,
          throughput: lifecycle.length / (duration / 1000)
        }
      };

    } catch (error) {
      return {
        duration: Date.now() - startTime,
        success: false,
        operations: 0,
        errors: [error.message],
        metrics: {
          responseTime: 0,
          conflictRate: 0,
          errorRate: 1,
          throughput: 0
        }
      };
    }
  }

  // 5.1.3 Stress Testing with Rapid Status Changes
  static async runStressTest(duration: number = 30000): Promise<TestResults> {
    const startTime = Date.now();
    const endTime = startTime + duration;
    const operations: Promise<any>[] = [];
    const errors: string[] = [];
    let operationCount = 0;

    try {
      console.log(`⚡ Starting stress test for ${duration}ms`);

      // Create multiple test orders
      const testOrders = await Promise.all([
        this.createTestOrder(),
        this.createTestOrder(),
        this.createTestOrder()
      ]);

      const statuses = ['confirmed', 'preparing', 'ready', 'preparing', 'confirmed'];

      while (Date.now() < endTime) {
        for (const orderId of testOrders) {
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
          operationCount++;
          
          const operation = supabase.functions.invoke('admin-orders-manager', {
            body: {
              action: 'update_status',
              orderId,
              newStatus: randomStatus,
              adminSessionId: `stress_test_${operationCount}_${Date.now()}`
            }
          }).catch(error => {
            errors.push(`Operation ${operationCount}: ${error.message}`);
          });

          operations.push(operation);
        }

        // Very short delay to simulate rapid operations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for remaining operations
      await Promise.allSettled(operations);
      const testDuration = Date.now() - startTime;

      return {
        duration: testDuration,
        success: errors.length < operationCount * 0.1, // Allow 10% error rate for stress test
        operations: operationCount,
        errors,
        metrics: {
          responseTime: testDuration / operationCount,
          conflictRate: 0, // Calculate from actual conflicts
          errorRate: errors.length / operationCount,
          throughput: operationCount / (testDuration / 1000)
        }
      };

    } catch (error) {
      return {
        duration: Date.now() - startTime,
        success: false,
        operations: operationCount,
        errors: [error.message],
        metrics: {
          responseTime: 0,
          conflictRate: 0,
          errorRate: 1,
          throughput: 0
        }
      };
    }
  }

  // 5.1.4 Edge Case Testing
  static async runEdgeCaseTests(): Promise<TestResults> {
    const startTime = Date.now();
    const errors: string[] = [];
    const testCases = [
      'invalid_order_id',
      'invalid_status',
      'expired_session',
      'network_timeout',
      'malformed_request'
    ];

    try {
      console.log('🔍 Running edge case tests');

      for (const testCase of testCases) {
        try {
          await this.runEdgeCaseScenario(testCase);
          console.log(`✅ Edge case passed: ${testCase}`);
        } catch (error) {
          errors.push(`${testCase}: ${error.message}`);
          console.log(`❌ Edge case failed: ${testCase}`);
        }
      }

      const duration = Date.now() - startTime;
      return {
        duration,
        success: errors.length === 0,
        operations: testCases.length,
        errors,
        metrics: {
          responseTime: duration / testCases.length,
          conflictRate: 0,
          errorRate: errors.length / testCases.length,
          throughput: testCases.length / (duration / 1000)
        }
      };

    } catch (error) {
      return {
        duration: Date.now() - startTime,
        success: false,
        operations: testCases.length,
        errors: [error.message],
        metrics: {
          responseTime: 0,
          conflictRate: 0,
          errorRate: 1,
          throughput: 0
        }
      };
    }
  }

  // Helper Methods
  private static async simulateAdminOperation(
    orderId: string,
    adminSessionId: string,
    operationIndex: number,
    delay: number,
    signal: AbortSignal
  ) {
    if (signal.aborted) throw new Error('Test aborted');

    await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 100));

    const statuses = ['confirmed', 'preparing', 'ready'];
    const randomStatus = statuses[operationIndex % statuses.length];

    try {
      const response = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'update_status',
          orderId,
          newStatus: randomStatus,
          adminSessionId
        }
      });

      return {
        success: !response.error,
        conflict: response.data?.error === 'CONCURRENT_UPDATE_IN_PROGRESS',
        response: response.data
      };
    } catch (error) {
      return {
        success: false,
        conflict: false,
        error: error.message
      };
    }
  }

  private static async createTestOrder(): Promise<string> {
    // Create a test order for testing purposes
    const orderNumber = `TEST_${Date.now()}`;
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_name: 'Test Customer',
        customer_phone: '+1234567890',
        status: 'pending',
        total_amount: 50.00,
        payment_status: 'pending'
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private static async runEdgeCaseScenario(testCase: string): Promise<void> {
    const scenarios = {
      invalid_order_id: () => supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'update_status',
          orderId: 'invalid-uuid',
          newStatus: 'confirmed',
          adminSessionId: 'test'
        }
      }),
      invalid_status: () => supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'update_status',
          orderId: '123e4567-e89b-12d3-a456-426614174000',
          newStatus: 'invalid_status',
          adminSessionId: 'test'
        }
      }),
      expired_session: () => supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'update_status',
          orderId: '123e4567-e89b-12d3-a456-426614174000',
          newStatus: 'confirmed',
          adminSessionId: 'expired_session_test'
        }
      }),
      network_timeout: () => new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Network timeout simulation')), 1000);
      }),
      malformed_request: () => supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'invalid_action',
          malformed: true
        }
      })
    };

    const scenario = scenarios[testCase];
    if (!scenario) throw new Error(`Unknown test case: ${testCase}`);

    try {
      await scenario();
      // If it doesn't throw, that might be unexpected for some edge cases
      if (['invalid_order_id', 'invalid_status', 'malformed_request'].includes(testCase)) {
        throw new Error(`Expected ${testCase} to throw an error`);
      }
    } catch (error) {
      // For edge cases, errors might be expected
      if (['network_timeout'].includes(testCase)) {
        // This is expected
        return;
      }
      throw error;
    }
  }

  static stopAllTests(): void {
    console.log('🛑 Stopping all running tests');
    this.testSessions.forEach(controller => controller.abort());
    this.testSessions.clear();
  }
}

// Export test scenarios for UI
export const DEFAULT_TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'concurrent_admins',
    name: 'Concurrent Admin Sessions',
    description: 'Test multiple admins updating orders simultaneously',
    type: 'concurrent',
    status: 'pending'
  },
  {
    id: 'order_lifecycle',
    name: 'Complete Order Lifecycle',
    description: 'Test full order progression from confirmed to completed',
    type: 'lifecycle',
    status: 'pending'
  },
  {
    id: 'stress_test',
    name: 'Rapid Status Changes',
    description: 'High-frequency order status updates under load',
    type: 'stress',
    status: 'pending'
  },
  {
    id: 'edge_cases',
    name: 'Edge Case Scenarios',
    description: 'Invalid inputs, timeouts, and error conditions',
    type: 'edge_case',
    status: 'pending'
  }
];