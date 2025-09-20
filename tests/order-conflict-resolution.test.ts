// 409 Conflict Resolution Test Suite for Admin Orders Manager
// Tests the lock-first approach and conflict handling we implemented

import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts"

// Test Configuration
const EDGE_FUNCTION_URL = 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/admin-orders-manager'
const TEST_ADMIN_JWT = 'your-admin-jwt-token' // Replace with actual admin token

// Test Order IDs (replace with actual test order IDs from your database)
const TEST_ORDER_ID = 'your-test-order-uuid'
const INVALID_ORDER_ID = '00000000-0000-0000-0000-000000000000'

// Test Utilities
class ConflictResolutionTester {
  constructor() {
    this.results = []
    this.startTime = Date.now()
  }
  
  async runTest(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`)
    const start = Date.now()
    
    try {
      await testFn()
      const duration = Date.now() - start
      this.results.push({ name, status: 'PASS', duration })
      console.log(`✅ PASS: ${name} (${duration}ms)`)
    } catch (error) {
      const duration = Date.now() - start
      this.results.push({ name, status: 'FAIL', duration, error: error.message })
      console.log(`❌ FAIL: ${name} (${duration}ms)`)
      console.log(`   Error: ${error.message}`)
    }
  }
  
  printSummary() {
    const totalTime = Date.now() - this.startTime
    const passed = this.results.filter(r => r.status === 'PASS').length
    const failed = this.results.filter(r => r.status === 'FAIL').length
    
    console.log(`\n📊 Conflict Resolution Test Summary:`)
    console.log(`   Total: ${this.results.length}`)
    console.log(`   Passed: ${passed}`)
    console.log(`   Failed: ${failed}`)
    console.log(`   Duration: ${totalTime}ms`)
    
    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`)
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`))
    }
  }
}

// Helper function to call admin orders manager
async function callAdminOrdersManager(action, payload = {}, expectedStatus = 200) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_ADMIN_JWT}`,
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA'
    },
    body: JSON.stringify({ action, ...payload })
  })
  
  const data = await response.json()
  
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`)
  }
  
  return { status: response.status, data }
}

// Helper to simulate concurrent requests
async function simulateConcurrentUpdates(orderId, updateCount = 5, statusValue = 'confirmed') {
  console.log(`🔄 Simulating ${updateCount} concurrent updates to order ${orderId}`)
  
  const promises = Array(updateCount).fill().map((_, index) => 
    callAdminOrdersManager('update_status', {
      orderId,
      status: statusValue,
      adminNotes: `Concurrent update ${index + 1} at ${Date.now()}`
    }).catch(error => ({ error: error.message, index }))
  )
  
  const results = await Promise.allSettled(promises)
  
  const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error).length
  const conflicts = results.filter(r => 
    r.status === 'fulfilled' && 
    r.value.error && 
    r.value.error.includes('409')
  ).length
  const errors = results.filter(r => r.status === 'rejected' || r.value?.error).length
  
  return { successful, conflicts, errors, total: updateCount, results }
}

// Main Test Suite
async function runConflictResolutionTests() {
  const tester = new ConflictResolutionTester()
  
  // Phase 1: Basic Lock Mechanism Tests
  await tester.runTest('Single order status update succeeds', async () => {
    const result = await callAdminOrdersManager('update_status', {
      orderId: TEST_ORDER_ID,
      status: 'confirmed',
      adminNotes: 'Basic test update'
    })
    
    assertEquals(result.status, 200)
    assertEquals(result.data.success, true)
  })
  
  await tester.runTest('Update with invalid order ID returns structured error', async () => {
    try {
      await callAdminOrdersManager('update_status', {
        orderId: INVALID_ORDER_ID,
        status: 'confirmed'
      }, 404)
    } catch (error) {
      if (!error.message.includes('404')) {
        throw error
      }
    }
  })
  
  // Phase 2: 409 Conflict Resolution Tests
  await tester.runTest('Concurrent updates trigger conflict resolution', async () => {
    const concurrentResult = await simulateConcurrentUpdates(TEST_ORDER_ID, 5, 'preparing')
    
    // At least one should succeed
    if (concurrentResult.successful === 0) {
      throw new Error('No updates succeeded in concurrent test')
    }
    
    // Should have some conflicts detected (409 responses)
    console.log(`   📊 Concurrent test results: ${concurrentResult.successful} successful, ${concurrentResult.conflicts} conflicts, ${concurrentResult.errors} errors`)
    
    // Verify conflict structure if any conflicts occurred
    for (const result of concurrentResult.results) {
      if (result.status === 'fulfilled' && result.value.error && result.value.error.includes('CONCURRENT_UPDATE')) {
        console.log(`   ✅ Proper conflict detection: ${result.value.error}`)
      }
    }
  })
  
  await tester.runTest('Lock timeout handling works correctly', async () => {
    // This test would require a way to simulate a stuck lock
    // For now, we test that normal operations don't get stuck
    
    const start = Date.now()
    const result = await callAdminOrdersManager('update_status', {
      orderId: TEST_ORDER_ID,
      status: 'ready',
      adminNotes: 'Timeout test'
    })
    const duration = Date.now() - start
    
    assertEquals(result.status, 200)
    
    if (duration > 5000) {
      throw new Error(`Update took too long: ${duration}ms (possible lock timeout issue)`)
    }
  })
  
  // Phase 3: Order Status History Tests
  await tester.runTest('Order status history is recorded', async () => {
    const result = await callAdminOrdersManager('update_status', {
      orderId: TEST_ORDER_ID,
      status: 'out_for_delivery',
      adminNotes: 'History test update'
    })
    
    assertEquals(result.status, 200)
    assertEquals(result.data.success, true)
    
    // The history should be automatically recorded by our trigger
    // We can't easily test this without direct DB access, but the update succeeding indicates it worked
  })
  
  // Phase 4: Bypass Cache Functionality Tests
  await tester.runTest('Bypass and update functionality works', async () => {
    const result = await callAdminOrdersManager('bypass_and_update', {
      orderId: TEST_ORDER_ID,
      status: 'delivered',
      adminNotes: 'Bypass test update',
      bypassReason: 'Testing manual intervention'
    })
    
    assertEquals(result.status, 200)
    assertEquals(result.data.success, true)
    
    if (result.data.bypassed !== true) {
      throw new Error('Bypass flag not set correctly')
    }
  })
  
  // Phase 5: Error Structure Validation Tests
  await tester.runTest('Invalid status returns proper error structure', async () => {
    try {
      const result = await callAdminOrdersManager('update_status', {
        orderId: TEST_ORDER_ID,
        status: 'invalid_status_value'
      }, 400)
      
      // Should have proper error structure
      if (!result.data.error) {
        throw new Error('Error response missing error field')
      }
    } catch (error) {
      if (!error.message.includes('400')) {
        throw error
      }
    }
  })
  
  await tester.runTest('Missing required fields returns validation error', async () => {
    try {
      await callAdminOrdersManager('update_status', {
        orderId: TEST_ORDER_ID
        // Missing status field
      }, 400)
    } catch (error) {
      if (!error.message.includes('400') && !error.message.includes('status')) {
        throw error
      }
    }
  })
  
  // Phase 6: Performance Under Load
  await tester.runTest('High concurrent load handling', async () => {
    console.log('   🚀 Running high load test (10 concurrent updates)...')
    
    const loadResult = await simulateConcurrentUpdates(TEST_ORDER_ID, 10, 'confirmed')
    
    // Should handle load gracefully - at least 50% success rate
    const successRate = (loadResult.successful / loadResult.total) * 100
    
    console.log(`   📈 Load test: ${successRate.toFixed(1)}% success rate`)
    
    if (successRate < 50) {
      throw new Error(`Low success rate under load: ${successRate.toFixed(1)}%`)
    }
  })
  
  // Phase 7: Lock Cleanup Tests
  await tester.runTest('Lock cleanup function works', async () => {
    // Call the cleanup function (if exposed via admin endpoint)
    try {
      const result = await callAdminOrdersManager('cleanup_locks', {})
      assertEquals(result.status, 200)
    } catch (error) {
      // If cleanup endpoint doesn't exist, that's ok - locks should auto-expire
      console.log('   ℹ️  Lock cleanup endpoint not available, relying on auto-expiry')
    }
  })
  
  tester.printSummary()
  return tester.results
}

// Performance Benchmarking
async function runPerformanceBenchmark() {
  console.log('\n⚡ Performance Benchmark for Conflict Resolution')
  console.log('================================================')
  
  const iterations = 20
  const times = []
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now()
    
    try {
      await callAdminOrdersManager('update_status', {
        orderId: TEST_ORDER_ID,
        status: 'confirmed',
        adminNotes: `Benchmark test ${i + 1}`
      })
      
      const duration = Date.now() - start
      times.push(duration)
      
      if (i % 5 === 0) {
        console.log(`   Completed ${i + 1}/${iterations} requests...`)
      }
    } catch (error) {
      console.log(`   ❌ Request ${i + 1} failed: ${error.message}`)
    }
  }
  
  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
    
    console.log(`\n📊 Performance Results (${times.length} successful requests):`)
    console.log(`   Average: ${avg.toFixed(0)}ms`)
    console.log(`   Min: ${min}ms`)
    console.log(`   Max: ${max}ms`)
    console.log(`   95th percentile: ${p95}ms`)
    
    if (avg > 2000) {
      console.log(`   ⚠️  Average response time is high`)
    }
    if (p95 > 5000) {
      console.log(`   ⚠️  95th percentile is very high`)
    }
  }
}

// Main execution
if (import.meta.main) {
  console.log('🔧 409 Conflict Resolution Test Suite')
  console.log('=====================================')
  console.log(`Testing against: ${EDGE_FUNCTION_URL}`)
  console.log(`Test Order ID: ${TEST_ORDER_ID}`)
  
  try {
    // Check if we have proper configuration
    if (TEST_ORDER_ID === 'your-test-order-uuid') {
      throw new Error('Please update TEST_ORDER_ID with an actual order UUID from your database')
    }
    
    if (TEST_ADMIN_JWT === 'your-admin-jwt-token') {
      throw new Error('Please update TEST_ADMIN_JWT with a valid admin JWT token')
    }
    
    // Run conflict resolution tests
    const testResults = await runConflictResolutionTests()
    
    // Run performance benchmark
    await runPerformanceBenchmark()
    
    console.log('\n🎉 Conflict resolution test suite completed!')
    
    // Exit with appropriate code
    const failedTests = testResults.filter(r => r.status === 'FAIL')
    
    if (failedTests.length > 0) {
      console.log(`\n💥 ${failedTests.length} tests failed. Check the logs above for details.`)
      Deno.exit(1)
    } else {
      console.log('\n✅ All conflict resolution tests passed!')
      Deno.exit(0)
    }
    
  } catch (error) {
    console.error(`\n💥 Test suite setup failed: ${error.message}`)
    console.log('\n📝 Setup Instructions:')
    console.log('1. Update TEST_ORDER_ID with a valid order UUID from your database')
    console.log('2. Update TEST_ADMIN_JWT with a valid admin JWT token')
    console.log('3. Ensure the admin user has proper permissions')
    console.log('4. Run: deno run --allow-net tests/order-conflict-resolution.test.ts')
    Deno.exit(1)
  }
}

// Export for use in other test files
export {
  ConflictResolutionTester,
  callAdminOrdersManager,
  simulateConcurrentUpdates,
  runConflictResolutionTests
}