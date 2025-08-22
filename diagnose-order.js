// Order Diagnosis Script - Run in browser console
// Usage: Copy and paste this entire script into the browser console on your app

async function diagnoseSpecificOrder() {
  console.log('🔍 Starting diagnosis for order ORD17558639864c0bf0...');
  
  try {
    // Import the diagnosis utility
    const { diagnoseOrder } = await import('./src/utils/orderDiagnostics.js');
    
    // Run diagnosis
    const result = await diagnoseOrder('ORD17558639864c0bf0');
    
    if (result.success) {
      console.log('✅ Diagnosis completed successfully');
      console.log('📊 Report:', result.report);
      
      if (result.recovered) {
        console.log('🎉 Order has been recovered and is now confirmed!');
      } else {
        console.log('⚠️ Order is still pending - may need manual intervention');
        console.log('💡 Next steps:');
        console.log('1. Check Paystack dashboard for transaction status');
        console.log('2. Verify webhook secret is configured correctly');
        console.log('3. Check if webhook endpoint is accessible');
      }
    } else {
      console.error('❌ Diagnosis failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Script error:', error);
    console.log('🔧 Alternative: Use the diagnosis utility directly in your code');
  }
}

// Auto-run the diagnosis
diagnoseSpecificOrder();