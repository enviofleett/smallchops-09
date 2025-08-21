// Debug script to test payment reference validation
async function debugPaymentFlow() {
  const reference = "txn_1755786177590_e94ff65a"; // Your failing reference
  
  // 1. Check API key health
  const healthCheck = await fetch('/functions/v1/paystack-debug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check_key_health' })
  });
  
  console.log('Key Health:', await healthCheck.json());
  
  // 2. Check if reference exists on Paystack
  const refCheck = await fetch('/functions/v1/paystack-debug', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check_reference', reference })
  });
  
  console.log('Reference Check:', await refCheck.json());
}

// Run this in browser console on your site
debugPaymentFlow();