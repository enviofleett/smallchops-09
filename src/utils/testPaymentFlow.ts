/**
 * Test Payment Verification Flow
 * Quick test for the specific transaction mentioned in the issue
 */

import { RobustStorage } from './robustStorage';

export const testPaymentVerificationFlow = () => {
  console.log('🧪 Testing Payment Verification Flow');
  
  // Test the specific transaction from the issue
  const testReference = 'txn_1755858631052_cedc24a3';
  const testOrderId = 'cedc24a3-6794-491f-b7a6-dc33c83e5cb8';
  
  console.log('Testing with reference:', testReference);
  console.log('Testing with order ID:', testOrderId);
  
  // Test storage availability
  RobustStorage.logStorageDiagnostics();
  
  // Test storage operations
  const testData = {
    reference: testReference,
    orderId: testOrderId,
    amount: 5000,
    timestamp: Date.now()
  };
  
  // Test storing
  console.log('🔄 Testing storage operations...');
  RobustStorage.setItem('test_payment_data', testData);
  
  // Test retrieval
  const retrieved = RobustStorage.getItem('test_payment_data');
  console.log('Retrieved data:', retrieved);
  
  // Test URL parsing
  const testUrl = `https://startersmallchops.com/payment/callback?reference=${testReference}&status=success&order_id=${testOrderId}`;
  const url = new URL(testUrl);
  const params = new URLSearchParams(url.search);
  
  console.log('URL parsing test:');
  console.log('Reference from URL:', params.get('reference'));
  console.log('Status from URL:', params.get('status'));
  console.log('Order ID from URL:', params.get('order_id'));
  
  // Clean up test data
  RobustStorage.removeItem('test_payment_data');
  
  console.log('✅ Payment verification flow test completed');
};

// Auto-run test in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Run test after a short delay to ensure everything is loaded
  setTimeout(testPaymentVerificationFlow, 2000);
}