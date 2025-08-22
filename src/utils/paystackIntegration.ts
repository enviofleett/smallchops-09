// ================================================
// FRONTEND PAYSTACK INTEGRATION WITH ROBUST ERROR HANDLING
// Enhanced error handling, retry logic, and monitoring
// ================================================

import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface PaymentInitRequest {
  customer: {
    email: string
    name: string
    phone?: string
  }
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    customizations?: any
  }>
  fulfillment: {
    type: 'delivery' | 'pickup'
    address?: any
    pickup_point_id?: string
    delivery_zone_id?: string
  }
}

export interface PaymentResponse {
  success: boolean
  order?: {
    id: string
    order_number: string
    total_amount: number
    status: string
  }
  customer?: {
    id: string
    email: string
  }
  payment?: {
    authorization_url: string
    reference: string
  }
  error?: string
}

// Enhanced error types for better handling
export class PaymentError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'PaymentError'
  }
}

// Enhanced checkout function with retry logic
export async function initializeSecurePayment(
  request: PaymentInitRequest,
  options: {
    maxRetries?: number
    retryDelay?: number
    timeout?: number
  } = {}
): Promise<PaymentResponse> {
  const { maxRetries = 2, retryDelay = 1000, timeout = 30000 } = options

  // Validate request
  const validation = validatePaymentRequest(request)
  if (!validation.isValid) {
    throw new PaymentError(
      `Validation failed: ${validation.errors.join(', ')}`,
      'VALIDATION_ERROR',
      validation.errors,
      false
    )
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Payment initialization attempt ${attempt + 1}/${maxRetries + 1}`)

      // Add timeout to the checkout process
      const checkoutPromise = supabase.functions.invoke('process-checkout', {
        body: request,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Payment initialization timeout after 30 seconds')), 30000);
      });

      const { data, error } = await Promise.race([
        checkoutPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        const isRetryable = isRetryableError(error)
        lastError = new PaymentError(
          error.message || 'Payment initialization failed',
          'EDGE_FUNCTION_ERROR',
          error,
          isRetryable
        )

        if (!isRetryable || attempt === maxRetries) {
          throw lastError
        }

        console.log(`⏳ Retryable error detected, waiting ${retryDelay * (attempt + 1)}ms...`)
        await delay(retryDelay * (attempt + 1))
        continue
      }

      if (!data?.success) {
        throw new PaymentError(
          data?.error || 'Payment initialization failed',
          'PAYMENT_INIT_FAILED',
          data,
          false
        )
      }

      console.log('✅ Payment initialized successfully')
      return data as PaymentResponse

    } catch (error) {
      if (error instanceof PaymentError) {
        lastError = error
        if (!error.retryable || attempt === maxRetries) {
          throw error
        }
      } else {
        // Enhanced error handling for timeouts
        const isTimeoutError = error instanceof Error && error.message.includes('timeout');
        const errorMessage = isTimeoutError 
          ? 'Payment service is temporarily unavailable. Please try again in a few moments.'
          : error instanceof Error ? error.message : 'Unknown error occurred';
        
        lastError = new PaymentError(
          errorMessage,
          isTimeoutError ? 'TIMEOUT_ERROR' : 'UNKNOWN_ERROR',
          error,
          isTimeoutError // Timeout errors are retryable
        )
      }

      if (attempt < maxRetries) {
        console.log(`⏳ Retrying after error: ${lastError.message}`)
        await delay(retryDelay * (attempt + 1))
      }
    }
  }

  throw lastError || new PaymentError('All retry attempts failed', 'MAX_RETRIES_EXCEEDED')
}

// Enhanced payment verification function
export async function verifyPayment(
  reference: string,
  options: {
    maxRetries?: number
    retryDelay?: number
  } = {}
): Promise<any> {
  const { maxRetries = 3, retryDelay = 2000 } = options

  if (!reference || typeof reference !== 'string') {
    throw new PaymentError('Payment reference is required', 'INVALID_REFERENCE')
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 Payment verification attempt ${attempt + 1}/${maxRetries + 1}`)

      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { reference }
      })

      if (error) {
        const isRetryable = isRetryableError(error) || 
                          error.message?.includes('not found')
        
        lastError = new PaymentError(
          error.message || 'Payment verification failed',
          'VERIFICATION_ERROR',
          error,
          isRetryable
        )

        if (!isRetryable || attempt === maxRetries) {
          throw lastError
        }

        await delay(retryDelay * (attempt + 1))
        continue
      }

      if (!data?.success) {
        throw new PaymentError(
          data?.error || 'Payment verification failed',
          'VERIFICATION_FAILED',
          data,
          false
        )
      }

      console.log('✅ Payment verified successfully')
      return data

    } catch (error) {
      if (error instanceof PaymentError) {
        lastError = error
        if (!error.retryable || attempt === maxRetries) {
          throw error
        }
      } else {
        lastError = new PaymentError(
          error instanceof Error ? error.message : 'Verification failed',
          'VERIFICATION_ERROR',
          error,
          true
        )
      }

      if (attempt < maxRetries) {
        await delay(retryDelay * (attempt + 1))
      }
    }
  }

  throw lastError || new PaymentError('Payment verification failed after all retries')
}

// Enhanced payment redirect with safety checks
export function redirectToPayment(authorizationUrl: string): void {
  try {
    // Validate URL
    const url = new URL(authorizationUrl)
    if (!url.hostname.includes('paystack.com')) {
      throw new PaymentError('Invalid payment URL', 'INVALID_URL')
    }

    console.log('🌐 Redirecting to payment gateway...')
    window.location.href = authorizationUrl

  } catch (error) {
    console.error('❌ Payment redirect failed:', error)
    toast.error('Unable to redirect to payment gateway. Please try again.')
    throw new PaymentError(
      'Payment redirect failed',
      'REDIRECT_ERROR',
      error
    )
  }
}

// Complete payment flow with comprehensive error handling
export async function processPaymentFlow(request: PaymentInitRequest): Promise<void> {
  try {
    toast.loading('Initializing payment...', { id: 'payment-flow' })

    const response = await initializeSecurePayment(request)

    if (!response.payment?.authorization_url) {
      throw new PaymentError(
        'Payment initialization incomplete - missing authorization URL',
        'INCOMPLETE_INIT'
      )
    }

    toast.success('Payment initialized successfully', { id: 'payment-flow' })
    
    // Store payment reference for later verification
    if (response.payment.reference) {
      sessionStorage.setItem('pending_payment_reference', response.payment.reference)
      sessionStorage.setItem('pending_order_id', response.order?.id || '')
    }

    redirectToPayment(response.payment.authorization_url)

  } catch (error) {
    console.error('❌ Payment flow failed:', error)
    
    const errorMessage = error instanceof PaymentError 
      ? error.message 
      : 'Payment initialization failed. Please try again.'

    toast.error(errorMessage, { id: 'payment-flow' })
    
    // Re-throw for component-level handling
    throw error
  }
}

// Check for pending payments on app load
export async function checkPendingPayment(): Promise<any | null> {
  try {
    const reference = sessionStorage.getItem('pending_payment_reference')
    const orderId = sessionStorage.getItem('pending_order_id')

    if (!reference) {
      return null
    }

    console.log('🔍 Checking pending payment:', reference)

    const result = await verifyPayment(reference, { maxRetries: 1 })

    // Clear stored reference after successful verification
    if (result.success) {
      sessionStorage.removeItem('pending_payment_reference')
      sessionStorage.removeItem('pending_order_id')
      
      toast.success('Payment verified successfully!')
    }

    return result

  } catch (error) {
    console.log('🔍 No pending payment or verification failed')
    return null
  }
}

// Utility functions
function validatePaymentRequest(request: PaymentInitRequest): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!request.customer?.email) {
    errors.push('Customer email is required')
  }

  if (!request.customer?.name) {
    errors.push('Customer name is required')
  }

  if (!request.items || request.items.length === 0) {
    errors.push('At least one item is required')
  }

  if (!request.fulfillment?.type) {
    errors.push('Fulfillment type is required')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

function isRetryableError(error: any): boolean {
  if (!error) return false

  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /connection/i,
    /temporary/i,
    /503/,
    /502/,
    /500/
  ]

  const errorMessage = error.message || error.toString() || ''
  return retryablePatterns.some(pattern => pattern.test(errorMessage))
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Health check function
export async function checkPaymentHealth(): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('paystack-health-monitor')
    
    if (error) {
      throw new Error(error.message)
    }

    return data
  } catch (error) {
    console.error('❌ Payment health check failed:', error)
    return {
      success: false,
      health_report: {
        overall_status: 'critical',
        error: error instanceof Error ? error.message : 'Health check failed'
      }
    }
  }
}