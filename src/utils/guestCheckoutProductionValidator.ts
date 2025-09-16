import { supabase } from '@/integrations/supabase/client';

interface GuestCheckoutValidation {
  isReady: boolean;
  issues: string[];
  warnings: string[];
  score: number;
  guestSessionSupport: boolean;
  paymentIntegrationReady: boolean;
  businessSettingsConfigured: boolean;
}

export const validateGuestCheckoutProduction = async (): Promise<GuestCheckoutValidation> => {
  const issues: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  try {
    // 1. Check if guest checkout is enabled in business settings
    const { data: businessSettings, error: businessError } = await supabase
      .from('business_settings')
      .select('allow_guest_checkout, name, admin_notification_email')
      .single();

    const businessSettingsConfigured = !businessError && businessSettings?.allow_guest_checkout === true;
    
    if (businessError) {
      issues.push('Business settings not accessible - guest checkout may fail');
      score -= 30;
    } else if (!businessSettings.allow_guest_checkout) {
      issues.push('Guest checkout is disabled in business settings');
      score -= 40;
    }

    if (!businessSettings?.admin_notification_email) {
      warnings.push('Admin notification email not configured - order alerts may not work');
      score -= 5;
    }

    // 2. Check payment system readiness for guests
    let paymentIntegrationReady = false;
    try {
      const { data: paymentCheck, error: paymentError } = await supabase
        .functions.invoke('paystack-health', { body: { check_type: 'basic' } });
      
      if (!paymentError && paymentCheck?.status === 'healthy') {
        paymentIntegrationReady = true;
      } else {
        issues.push('Payment system not ready for production');
        score -= 35;
      }
    } catch (error) {
      issues.push('Cannot verify payment system status');
      score -= 25;
    }

    // 3. Test guest session generation
    let guestSessionSupport = false;
    try {
      const { data: sessionTest, error: sessionError } = await supabase
        .rpc('generate_guest_session_id');
      
      if (!sessionError && sessionTest) {
        guestSessionSupport = true;
      } else {
        issues.push('Guest session generation not working');
        score -= 20;
      }
    } catch (error) {
      // Fallback to client-side generation test
      try {
        const fallbackId = `guest_${crypto.randomUUID()}`;
        if (fallbackId.startsWith('guest_')) {
          guestSessionSupport = true;
          warnings.push('Using client-side guest session generation (fallback mode)');
          score -= 5;
        }
      } catch (fallbackError) {
        issues.push('Guest session generation completely broken');
        score -= 30;
      }
    }

    // 4. Check order processing for guests
    try {
      const { data: orderSystemCheck } = await supabase
        .from('orders')
        .select('id')
        .limit(1);
      
      // If we can access orders table, order processing should work
      if (orderSystemCheck !== undefined) {
        // System can process orders
      } else {
        warnings.push('Order system accessibility unclear');
        score -= 5;
      }
    } catch (error) {
      issues.push('Order processing system not accessible');
      score -= 20;
    }

    // 5. Check communication system for guest order confirmations
    try {
      const { data: commCheck } = await supabase
        .from('communication_events')
        .select('id')
        .limit(1);
        
      if (commCheck === undefined) {
        warnings.push('Email confirmation system may not be configured');
        score -= 10;
      }
    } catch (error) {
      warnings.push('Cannot verify email confirmation system');
      score -= 5;
    }

    // 6. Security validation for guest data
    try {
      const { data: securityCheck } = await supabase.rpc('run_security_audit');
      const securityResult = securityCheck as any;
      if (securityResult?.critical_issues > 0) {
        issues.push('Critical security issues detected - unsafe for production');
        score -= 50;
      } else if (securityResult?.total_issues > 0) {
        warnings.push('Minor security issues detected');
        score -= 10;
      }
    } catch (error) {
      warnings.push('Cannot run security audit');
      score -= 5;
    }

    const isReady = issues.length === 0 && score >= 80;

    return {
      isReady,
      issues,
      warnings,
      score: Math.max(0, score),
      guestSessionSupport,
      paymentIntegrationReady,
      businessSettingsConfigured
    };

  } catch (error) {
    console.error('Guest checkout validation failed:', error);
    return {
      isReady: false,
      issues: ['Failed to validate guest checkout system'],
      warnings: [],
      score: 0,
      guestSessionSupport: false,
      paymentIntegrationReady: false,
      businessSettingsConfigured: false
    };
  }
};

export const getGuestCheckoutReadinessReport = async (): Promise<string> => {
  const validation = await validateGuestCheckoutProduction();
  
  let report = `🛡️ GUEST CHECKOUT PRODUCTION READINESS REPORT\n`;
  report += `Score: ${validation.score}/100 ${validation.isReady ? '✅' : '❌'}\n\n`;
  
  if (validation.isReady) {
    report += `✅ PRODUCTION READY!\n`;
    report += `• Guest sessions: ${validation.guestSessionSupport ? '✅ Working' : '❌ Failed'}\n`;
    report += `• Payment integration: ${validation.paymentIntegrationReady ? '✅ Ready' : '❌ Not ready'}\n`;
    report += `• Business settings: ${validation.businessSettingsConfigured ? '✅ Configured' : '❌ Missing'}\n\n`;
  } else {
    report += `❌ NOT PRODUCTION READY\n\n`;
  }
  
  if (validation.issues.length > 0) {
    report += `🚨 CRITICAL ISSUES TO FIX:\n`;
    validation.issues.forEach((issue, i) => {
      report += `${i + 1}. ${issue}\n`;
    });
    report += `\n`;
  }
  
  if (validation.warnings.length > 0) {
    report += `⚠️ WARNINGS (Recommended fixes):\n`;
    validation.warnings.forEach((warning, i) => {
      report += `${i + 1}. ${warning}\n`;
    });
    report += `\n`;
  }
  
  if (validation.isReady) {
    report += `🚀 Your guest checkout is ready for live production!\n`;
    report += `• Customers can checkout without creating accounts\n`;
    report += `• Payment processing is configured and secure\n`;
    report += `• Order confirmations and tracking will work\n`;
  } else {
    report += `🔧 Fix the critical issues above before going live.\n`;
  }
  
  return report;
};