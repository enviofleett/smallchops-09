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
  
  if (envResult.isTestMode) {
    // Try test-specific keys first
    secretKey = Deno.env.get('PAYSTACK_SECRET_KEY_TEST') || Deno.env.get('PAYSTACK_SECRET_KEY')
    publicKey = Deno.env.get('PAYSTACK_PUBLIC_KEY_TEST') || Deno.env.get('PAYSTACK_PUBLIC_KEY')
    webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET_TEST') || Deno.env.get('PAYSTACK_WEBHOOK_SECRET')
    
    console.log('🔧 Using TEST mode configuration')
  } else {
    // Try live-specific keys first
    secretKey = Deno.env.get('PAYSTACK_SECRET_KEY_LIVE') || Deno.env.get('PAYSTACK_SECRET_KEY')
    publicKey = Deno.env.get('PAYSTACK_PUBLIC_KEY_LIVE') || Deno.env.get('PAYSTACK_PUBLIC_KEY')
    webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET_LIVE') || Deno.env.get('PAYSTACK_WEBHOOK_SECRET')
    
    console.log('🚀 Using LIVE mode configuration')
  }
  
  // Validation
  if (!secretKey) {
    const availableKeys = Object.keys(Deno.env.toObject()).filter(key => key.includes('PAYSTACK'))
    throw new Error(`No Paystack secret key found for ${envResult.environment} environment. Available keys: ${availableKeys.join(', ')}`)
  }
  
  // Validate key format matches expected environment
  if (envResult.isTestMode && !secretKey.startsWith('sk_test_')) {
    console.warn('⚠️ Warning: Using non-test key in test environment:', secretKey.substring(0, 10))
  }
  
  if (!envResult.isTestMode && !secretKey.startsWith('sk_live_')) {
    console.warn('⚠️ Warning: Using non-live key in production environment:', secretKey.substring(0, 10))
  }
  
  console.log('🔑 Using secret key:', secretKey.substring(0, 10) + '...', `(${secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE'})`)
  
  return {
    secretKey,
    publicKey: publicKey || '',
    webhookSecret: webhookSecret || '',
    isTestMode: envResult.isTestMode,
    environment: envResult.environment
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