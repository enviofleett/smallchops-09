// ========================================
// PAYSTACK CONFIGURATION WITH ENVIRONMENT DETECTION
// Handles test/live key switching automatically
// ========================================

export interface PaystackConfig {
  secretKey: string
  publicKey: string
  webhookSecret: string
  isTestMode: boolean
  environment: 'test' | 'live'
}

export interface EnvironmentDetectionResult {
  isProduction: boolean
  isTestMode: boolean
  environment: 'test' | 'live'
  domain: string
}

// Detect environment based on various factors
export function detectEnvironment(request?: Request): EnvironmentDetectionResult {
  const referer = request?.headers.get('referer') || ''
  const origin = request?.headers.get('origin') || ''
  const host = request?.headers.get('host') || ''
  
  // Production domains (customize these for your actual domains)
  const productionDomains = [
    'startersmallchops.com',
    'www.startersmallchops.com',
    'startersmallchops.lovableproject.com',
    'startersmallchops.lovable.app',
    'oknnklksdiqaifhxaccs.supabase.co',
    'oknnklksdiqaifhxaccs.lovableproject.com',
    '7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovableproject.com'
    // Add your production domains here
  ]
  
  // Check if any of the domains indicate production
  const isProduction = productionDomains.some(domain => 
    referer.includes(domain) || 
    origin.includes(domain) || 
    host.includes(domain)
  )
  
  // Check for explicit environment variables
  const forceTestMode = Deno.env.get('FORCE_TEST_MODE') === 'true'
  const forceLiveMode = Deno.env.get('FORCE_LIVE_MODE') === 'true'
  
  let environment: 'test' | 'live' = 'test'
  let isTestMode = true
  
  if (forceLiveMode) {
    environment = 'live'
    isTestMode = false
  } else if (forceTestMode) {
    environment = 'test'
    isTestMode = true
  } else if (isProduction) {
    environment = 'live'
    isTestMode = false
  }
  
  return {
    isProduction,
    isTestMode,
    environment,
    domain: origin || referer || host
  }
}

// Get appropriate Paystack configuration based on environment
export function getPaystackConfig(request?: Request): PaystackConfig {
  const envResult = detectEnvironment(request)
  
  console.log('🌍 Environment detection:', {
    environment: envResult.environment,
    isTestMode: envResult.isTestMode,
    domain: envResult.domain
  })
  
  let secretKey: string | undefined
  let publicKey: string | undefined
  let webhookSecret: string | undefined
  
  // PRODUCTION FIX: Remove forced test mode - use environment detection
  if (envResult.isTestMode) {
    // Use test environment keys explicitly
    secretKey = Deno.env.get('PAYSTACK_SECRET_KEY_TEST') || Deno.env.get('PAYSTACK_SECRET_KEY')
    publicKey = Deno.env.get('PAYSTACK_PUBLIC_KEY_TEST') || Deno.env.get('PAYSTACK_PUBLIC_KEY')
    webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET_TEST') || Deno.env.get('PAYSTACK_WEBHOOK_SECRET')
    
    console.log('🔧 Using TEST mode configuration')
  } else {
    // Production mode - use live keys explicitly
    secretKey = Deno.env.get('PAYSTACK_SECRET_KEY_LIVE')
    publicKey = Deno.env.get('PAYSTACK_PUBLIC_KEY_LIVE')
    webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET_LIVE')
    
    console.log('🚀 Using LIVE mode configuration')
  }
  
  // Validation
  if (!secretKey) {
    const availableKeys = Object.keys(Deno.env.toObject()).filter(key => key.includes('PAYSTACK'))
    throw new Error(`No Paystack secret key found for ${envResult.environment} environment. Available keys: ${availableKeys.join(', ')}`)
  }
  
  // Determine actual mode based on key format
  const actualIsTestMode = secretKey.startsWith('sk_test_')
  const actualEnvironment: 'test' | 'live' = actualIsTestMode ? 'test' : 'live'
  
  console.log('🔑 Key format detection:', {
    key_prefix: secretKey.substring(0, 10),
    is_test_key: actualIsTestMode,
    configured_mode: envResult.isTestMode ? 'test' : 'live',
    actual_mode: actualEnvironment
  })
  
  console.log('🔑 Using secret key:', secretKey.substring(0, 10) + '...', `(${secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE'})`)
  
  return {
    secretKey,
    publicKey: publicKey || '',
    webhookSecret: webhookSecret || '',
    isTestMode: actualIsTestMode, // Use actual key format, not environment detection
    environment: actualEnvironment // Use actual key format, not environment detection
  }
}

// Validate Paystack configuration
export function validatePaystackConfig(config: PaystackConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!config.secretKey) {
    errors.push('Secret key is missing')
  } else if (!config.secretKey.startsWith('sk_test_') && !config.secretKey.startsWith('sk_live_')) {
    errors.push('Invalid secret key format (must start with sk_test_ or sk_live_)')
  }
  
  if (config.isTestMode && !config.secretKey.startsWith('sk_test_')) {
    errors.push('Test mode requires test secret key (sk_test_)')
  }
  
  if (!config.isTestMode && !config.secretKey.startsWith('sk_live_')) {
    errors.push('Live mode requires live secret key (sk_live_)')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Log configuration status for debugging
export function logPaystackConfigStatus(config: PaystackConfig) {
  console.log('📊 Paystack Configuration Status:', {
    environment: config.environment,
    isTestMode: config.isTestMode,
    hasSecretKey: !!config.secretKey,
    hasPublicKey: !!config.publicKey,
    hasWebhookSecret: !!config.webhookSecret,
    secretKeyType: config.secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE',
    secretKeyPrefix: config.secretKey.substring(0, 10) + '...'
  })
}