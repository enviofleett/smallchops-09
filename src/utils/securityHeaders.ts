/**
 * Security Headers Utility
 * Validates and reports on security headers
 */

interface SecurityHeaderCheck {
  name: string;
  present: boolean;
  value?: string;
  recommendation?: string;
}

/**
 * Check security headers in the current page
 */
export const checkSecurityHeaders = (): SecurityHeaderCheck[] => {
  const checks: SecurityHeaderCheck[] = [];
  
  // Check CSP
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  checks.push({
    name: 'Content-Security-Policy',
    present: !!cspMeta,
    value: cspMeta?.getAttribute('content') || undefined,
    recommendation: !cspMeta ? 'Add CSP meta tag for XSS protection' : undefined
  });
  
  // Check if running over HTTPS
  checks.push({
    name: 'HTTPS',
    present: location.protocol === 'https:',
    value: location.protocol,
    recommendation: location.protocol !== 'https:' ? 'Use HTTPS in production' : undefined
  });
  
  // Check referrer policy
  const referrerMeta = document.querySelector('meta[name="referrer"]');
  checks.push({
    name: 'Referrer-Policy',
    present: !!referrerMeta,
    value: referrerMeta?.getAttribute('content') || undefined,
    recommendation: !referrerMeta ? 'Add referrer policy for privacy' : undefined
  });
  
  return checks;
};

/**
 * Validate Paystack CSP compatibility
 */
export const validatePaystackCSP = (): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!cspMeta) {
    issues.push('No CSP meta tag found');
    return { valid: false, issues };
  }
  
  const content = cspMeta.getAttribute('content') || '';
  
  const requiredDomains = [
    'checkout.paystack.com',
    'paystack.com',
    'js.paystack.co',
    'api.paystack.co'
  ];
  
  const missingDomains = requiredDomains.filter(domain => !content.includes(domain));
  
  if (missingDomains.length > 0) {
    issues.push(`Missing Paystack domains in CSP: ${missingDomains.join(', ')}`);
  }
  
  // Check for style-src-elem directive specifically
  if (!content.includes('style-src-elem')) {
    issues.push('Missing style-src-elem directive for external stylesheets');
  }
  
  return {
    valid: missingDomains.length === 0 && content.includes('style-src-elem'),
    issues
  };
};

/**
 * Report security status to console
 */
export const reportSecurityStatus = () => {
  const headers = checkSecurityHeaders();
  const paystackCSP = validatePaystackCSP();
  
  console.group('🔒 Security Status Report');
  
  headers.forEach(check => {
    if (check.present) {
      console.log(`✅ ${check.name}: Present`);
    } else {
      console.warn(`⚠️ ${check.name}: Missing - ${check.recommendation}`);
    }
  });
  
  if (paystackCSP.valid) {
    console.log('✅ Paystack CSP: Compatible');
  } else {
    console.warn('⚠️ Paystack CSP Issues:', paystackCSP.issues);
  }
  
  console.groupEnd();
};

/**
 * Initialize security monitoring
 */
export const initializeSecurityMonitoring = () => {
  // Only report in development
  if (import.meta.env.DEV) {
    reportSecurityStatus();
  }
  
  // Set up CSP violation reporting with production-safe filtering
  document.addEventListener('securitypolicyviolation', (e) => {
    // Enhanced filtering for known safe violations in production
    const ignoredViolations = [
      'manifest-src',
      'https://lovable.dev/auth-bridge',
      'chrome-extension:',
      'moz-extension:',
      'safari-web-extension:',
      'manifest.json',
      '.lovableproject.com/manifest.json'
    ];
    
    const shouldIgnore = ignoredViolations.some(pattern => 
      e.blockedURI?.includes(pattern) || 
      e.violatedDirective?.includes(pattern) ||
      e.sourceFile?.includes(pattern)
    );
    
    // Additional check for known safe auth-bridge and manifest violations
    const isKnownSafeViolation = e.blockedURI && (
      e.blockedURI.includes('manifest.json') ||
      e.blockedURI.includes('auth-bridge') ||
      e.blockedURI.includes('lovable.dev/auth-bridge') ||
      e.blockedURI.includes('.lovableproject.com/manifest.json')
    );
    
    if (!shouldIgnore && !isKnownSafeViolation) {
      console.error('CSP Violation:', {
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI,
        documentURI: e.documentURI
      });
    }
  });
};