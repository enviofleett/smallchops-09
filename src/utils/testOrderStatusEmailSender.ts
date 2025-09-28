import { sendOrderStatusEmail, sendOrderStatusEmailWithFallback } from './sendOrderStatusEmail';
import { OrderStatus } from '@/types/orderDetailsModal';

/**
 * Test harness for order status email sender
 * 
 * Usage:
 * 1. Update the TEST_CONFIG below with your test parameters
 * 2. Run: npx ts-node src/utils/testOrderStatusEmailSender.ts
 * 3. Check your email inbox for the test email
 */

const TEST_CONFIG = {
  // Update these values for testing
  recipientEmail: 'test@example.com', // Change this to your email
  adminEmail: 'admin@starterssmallchops.com',
  testOrderData: {
    id: 'test-order-id-' + Date.now(),
    order_number: 'TEST-' + Date.now(),
    customer_name: 'John Test Customer',
    customer_email: 'test@example.com', // Change this to your email
    total_amount: 15750,
    status: 'confirmed' as OrderStatus,
    order_type: 'delivery' as const,
    created_at: new Date().toISOString(),
    items: [
      {
        product_name: 'Chicken Samosa',
        quantity: 10,
        unit_price: 500,
        total_price: 5000
      },
      {
        product_name: 'Spring Rolls',
        quantity: 15,
        unit_price: 450,
        total_price: 6750
      },
      {
        product_name: 'Poff Poff',
        quantity: 20,
        unit_price: 200,
        total_price: 4000
      }
    ],
    delivery_address: {
      address_line_1: '123 Test Street, Victoria Island',
      city: 'Lagos',
      state: 'Lagos State'
    },
    special_instructions: 'Please ring doorbell twice. Test order - do not prepare actual food.'
  },
  statusesToTest: [
    'confirmed',
    'preparing', 
    'ready',
    'out_for_delivery',
    'delivered'
  ] as OrderStatus[]
};

/**
 * Test individual order status email
 */
async function testSingleEmail(status: OrderStatus) {
  console.log(`\n📧 Testing ${status} email...`);
  
  const testData = {
    ...TEST_CONFIG.testOrderData,
    status,
    order_number: `TEST-${status.toUpperCase()}-${Date.now()}`
  };

  try {
    const success = await sendOrderStatusEmailWithFallback({
      to: TEST_CONFIG.recipientEmail,
      orderData: testData,
      status,
      adminEmail: TEST_CONFIG.adminEmail,
      trackingUrl: status === 'out_for_delivery' ? 'https://example.com/track/test123' : undefined
    });

    if (success) {
      console.log(`✅ ${status} email sent successfully!`);
    } else {
      console.log(`❌ ${status} email failed to send`);
    }
    
    return success;
  } catch (error: any) {
    console.error(`💥 Error sending ${status} email:`, error.message);
    return false;
  }
}

/**
 * Test all order status emails
 */
async function testAllEmails() {
  console.log('🚀 Starting Order Status Email Test Suite');
  console.log(`📧 Sending test emails to: ${TEST_CONFIG.recipientEmail}`);
  console.log(`👤 Admin email: ${TEST_CONFIG.adminEmail}`);
  console.log(`📋 Testing ${TEST_CONFIG.statusesToTest.length} different statuses\n`);

  const results: Record<string, boolean> = {};

  for (const status of TEST_CONFIG.statusesToTest) {
    results[status] = await testSingleEmail(status);
    
    // Wait between emails to avoid rate limiting
    if (TEST_CONFIG.statusesToTest.indexOf(status) < TEST_CONFIG.statusesToTest.length - 1) {
      console.log('⏳ Waiting 2 seconds before next email...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log('========================');
  
  let successCount = 0;
  for (const [status, success] of Object.entries(results)) {
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${status.toUpperCase().replace('_', ' ')}: ${success ? 'SUCCESS' : 'FAILED'}`);
    if (success) successCount++;
  }

  console.log(`\n📈 Overall Success Rate: ${successCount}/${Object.keys(results).length} (${Math.round(successCount / Object.keys(results).length * 100)}%)`);

  if (successCount === Object.keys(results).length) {
    console.log('\n🎉 All tests passed! Email system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }

  return results;
}

/**
 * Test specific email status (for quick testing)
 */
async function testSpecificStatus() {
  const status: OrderStatus = 'confirmed'; // Change this to test specific status
  console.log(`🎯 Testing specific status: ${status}`);
  
  await testSingleEmail(status);
}

/**
 * Validate configuration
 */
function validateConfig() {
  if (TEST_CONFIG.recipientEmail === 'test@example.com') {
    console.error('❌ Please update TEST_CONFIG.recipientEmail to your actual email address!');
    process.exit(1);
  }

  if (!TEST_CONFIG.recipientEmail.includes('@')) {
    console.error('❌ Invalid recipient email address!');
    process.exit(1);
  }

  console.log('✅ Configuration validated');
}

/**
 * Main test runner
 */
async function main() {
  console.log('🧪 Order Status Email Test Harness');
  console.log('==================================\n');

  validateConfig();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';

  switch (testType) {
    case 'all':
      await testAllEmails();
      break;
    case 'single':
      await testSpecificStatus();
      break;
    default:
      if (TEST_CONFIG.statusesToTest.includes(testType as OrderStatus)) {
        await testSingleEmail(testType as OrderStatus);
      } else {
        console.log('Usage:');
        console.log('  npm run test:emails          # Test all status emails');
        console.log('  npm run test:emails single   # Test specific status (edit testSpecificStatus function)');
        console.log('  npm run test:emails confirmed # Test specific status from command line');
        console.log('\nAvailable statuses:', TEST_CONFIG.statusesToTest.join(', '));
      }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test harness failed:', error);
    process.exit(1);
  });
}

// Export functions for use in other modules
export {
  testSingleEmail,
  testAllEmails,
  testSpecificStatus,
  TEST_CONFIG
};