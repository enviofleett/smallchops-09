// Payment Key Debug Script
// Run this in browser console to test Paystack configuration

async function debugPaymentKeys() {
  console.log('🔍 Debugging Paystack Payment Configuration...\n');
  
  try {
    // Test key health
    console.log('1️⃣ Testing Paystack Key Health...');
    const healthResponse = await fetch('/functions/v1/paystack-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_key_health' })
    });
    
    const healthData = await healthResponse.json();
    console.log('✅ Key Health Result:', healthData);
    
    // Test with a sample reference
    console.log('\n2️⃣ Testing Reference Verification...');
    const testRef = 'txn_' + Date.now() + '_test';
    const refResponse = await fetch('/functions/v1/paystack-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'check_reference', 
        reference: testRef 
      })
    });
    
    const refData = await refResponse.json();
    console.log('✅ Reference Check Result:', refData);
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('- Key Configured:', healthData.health_check?.key_configured);
    console.log('- Key Environment:', healthData.health_check?.key_environment);
    console.log('- API Connectivity:', healthData.health_check?.api_connectivity);
    
    if (healthData.health_check?.key_environment === 'TEST') {
      console.log('✅ Using TEST key - good for development');
    } else if (healthData.health_check?.key_environment === 'LIVE') {
      console.log('⚠️ Using LIVE key - ensure this is production');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugPaymentKeys();
