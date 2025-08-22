// Complete Order Recovery Test Script
// Run this in your browser console on the app

async function executeOrderRecoveryPlan() {
  const ORDER_NUMBER = 'ORD17558639864c0bf0';
  const PAYMENT_REF = 'txn_1755863987183_e46bbc31';
  
  console.log('🚀 Executing Order Recovery Plan');
  console.log('=====================================');
  
  try {
    // Step 1: Initial Diagnosis
    console.log('\n📋 Step 1: Initial Order Status Check');
    console.log('-----------------------------------');
    
    const checkOrder = async () => {
      const response = await fetch('https://oknnklksdiqaifhxaccs.supabase.co/rest/v1/orders?order_number=eq.' + ORDER_NUMBER + '&select=id,order_number,status,payment_status,payment_reference,total_amount,amount_kobo,paid_at,idempotency_key', {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA'
        }
      });
      return await response.json();
    };
    
    const initialOrder = await checkOrder();
    console.log('Initial order status:', initialOrder[0]);
    
    // Step 2: Direct Payment Verification
    console.log('\n💳 Step 2: Direct Payment Verification');
    console.log('------------------------------------');
    
    const verifyPayment = async () => {
      const response = await fetch('https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-secure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf7BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA'
        },
        body: JSON.stringify({
          action: 'verify',
          reference: PAYMENT_REF
        })
      });
      return await response.json();
    };
    
    const verificationResult = await verifyPayment();
    console.log('Direct verification result:', verificationResult);
    
    // Step 3: Check if verification worked
    console.log('\n🔄 Step 3: Post-Verification Status Check');
    console.log('----------------------------------------');
    
    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const updatedOrder = await checkOrder();
    console.log('Updated order status:', updatedOrder[0]);
    
    // Step 4: Batch Verification (if still pending)
    if (updatedOrder[0]?.status === 'pending') {
      console.log('\n🔄 Step 4: Batch Verification Fallback');
      console.log('------------------------------------');
      
      const batchVerify = async () => {
        const response = await fetch('https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-batch-verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA'
          },
          body: JSON.stringify({
            excludeOrderNumbers: [],
            limit: 1,
            dryRun: false,
            targetOrderNumber: ORDER_NUMBER
          })
        });
        return await response.json();
      };
      
      const batchResult = await batchVerify();
      console.log('Batch verification result:', batchResult);
      
      // Final check after batch
      await new Promise(resolve => setTimeout(resolve, 2000));
      const finalOrder = await checkOrder();
      console.log('Final order status after batch verification:', finalOrder[0]);
    }
    
    // Step 5: Payment Transaction Check
    console.log('\n💼 Step 5: Payment Transaction Status');
    console.log('----------------------------------');
    
    if (initialOrder[0]?.id) {
      const checkTransaction = async () => {
        const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/rest/v1/payment_transactions?order_id=eq.${initialOrder[0].id}&select=*`, {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA'
          }
        });
        return await response.json();
      };
      
      const transaction = await checkTransaction();
      console.log('Payment transaction:', transaction[0]);
    }
    
    // Step 6: Summary Report
    console.log('\n📊 Final Summary Report');
    console.log('=======================');
    const finalOrderStatus = await checkOrder();
    const finalOrder = finalOrderStatus[0];
    
    console.log('🎯 Recovery Results:');
    console.log(`   Order Number: ${finalOrder?.order_number}`);
    console.log(`   Status: ${finalOrder?.status}`);
    console.log(`   Payment Status: ${finalOrder?.payment_status}`);
    console.log(`   Paid At: ${finalOrder?.paid_at || 'Not paid'}`);
    console.log(`   Amount: ₦${finalOrder?.total_amount}`);
    console.log(`   Amount (kobo): ${finalOrder?.amount_kobo || 'Not set'}`);
    
    if (finalOrder?.status === 'confirmed') {
      console.log('✅ SUCCESS: Order has been successfully recovered!');
    } else {
      console.log('⚠️ ORDER STILL PENDING: Manual intervention may be required');
      console.log('\n🔧 Next Steps:');
      console.log('1. Check Paystack dashboard for transaction status');
      console.log('2. Verify webhook secret configuration');
      console.log('3. Test webhook endpoint accessibility');
      console.log('4. Consider manual order confirmation if payment was successful on Paystack');
    }
    
  } catch (error) {
    console.error('💥 Recovery plan failed:', error);
  }
}

// Execute the plan
console.log('🎬 Starting Order Recovery Plan Execution...');
executeOrderRecoveryPlan();