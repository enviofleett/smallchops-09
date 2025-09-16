/**
 * Emergency circuit breaker for production recovery attempts
 * Prevents system-wide infinite loops across all orders
 */

interface EmergencyBreakerState {
  globalAttempts: number;
  sessionStartTime: number;
  blockedUntil: number | null;
  affectedOrders: Set<string>;
}

class EmergencyCircuitBreaker {
  private static instance: EmergencyCircuitBreaker;
  private state: EmergencyBreakerState;
  
  // Production limits
  private readonly MAX_GLOBAL_ATTEMPTS = 50; // Max recovery attempts across all orders per session
  private readonly SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly COOLDOWN_PERIOD = 10 * 60 * 1000; // 10 minutes cooldown when triggered
  
  private constructor() {
    this.state = {
      globalAttempts: 0,
      sessionStartTime: Date.now(),
      blockedUntil: null,
      affectedOrders: new Set()
    };
  }
  
  static getInstance(): EmergencyCircuitBreaker {
    if (!EmergencyCircuitBreaker.instance) {
      EmergencyCircuitBreaker.instance = new EmergencyCircuitBreaker();
    }
    return EmergencyCircuitBreaker.instance;
  }
  
  /**
   * Check if recovery operations are currently blocked
   */
  isBlocked(): boolean {
    const now = Date.now();
    
    // Check if still in cooldown period
    if (this.state.blockedUntil && now < this.state.blockedUntil) {
      console.warn(`🚫 Emergency circuit breaker active. Blocked until ${new Date(this.state.blockedUntil).toLocaleTimeString()}`);
      return true;
    }
    
    // Reset cooldown if it has expired
    if (this.state.blockedUntil && now >= this.state.blockedUntil) {
      this.state.blockedUntil = null;
      console.log('✅ Emergency circuit breaker cooldown expired');
    }
    
    // Check if session should be reset
    if (now - this.state.sessionStartTime > this.SESSION_DURATION) {
      this.resetSession();
    }
    
    // Check if global limit reached
    if (this.state.globalAttempts >= this.MAX_GLOBAL_ATTEMPTS) {
      this.triggerEmergencyStop();
      return true;
    }
    
    return false;
  }
  
  /**
   * Record a recovery attempt for an order
   */
  recordAttempt(orderId: string): boolean {
    if (this.isBlocked()) {
      return false;
    }
    
    this.state.globalAttempts++;
    this.state.affectedOrders.add(orderId);
    
    console.log(`📊 Emergency circuit breaker: ${this.state.globalAttempts}/${this.MAX_GLOBAL_ATTEMPTS} global attempts, ${this.state.affectedOrders.size} affected orders`);
    
    // Check if we need to trigger emergency stop
    if (this.state.globalAttempts >= this.MAX_GLOBAL_ATTEMPTS) {
      this.triggerEmergencyStop();
      return false;
    }
    
    return true;
  }
  
  /**
   * Trigger emergency stop with cooldown
   */
  private triggerEmergencyStop(): void {
    const now = Date.now();
    this.state.blockedUntil = now + this.COOLDOWN_PERIOD;
    
    console.error(`🚨 EMERGENCY CIRCUIT BREAKER TRIGGERED!`);
    console.error(`📊 Stats: ${this.state.globalAttempts} global attempts across ${this.state.affectedOrders.size} orders`);
    console.error(`⏰ Blocked until: ${new Date(this.state.blockedUntil).toLocaleTimeString()}`);
    
    // Log to audit for monitoring
    this.logEmergencyStop();
  }
  
  /**
   * Reset session state
   */
  private resetSession(): void {
    console.log('🔄 Resetting emergency circuit breaker session');
    this.state = {
      globalAttempts: 0,
      sessionStartTime: Date.now(),
      blockedUntil: this.state.blockedUntil, // Keep cooldown if active
      affectedOrders: new Set()
    };
  }
  
  /**
   * Get current breaker status
   */
  getStatus() {
    return {
      isBlocked: this.isBlocked(),
      globalAttempts: this.state.globalAttempts,
      maxAttempts: this.MAX_GLOBAL_ATTEMPTS,
      affectedOrdersCount: this.state.affectedOrders.size,
      blockedUntil: this.state.blockedUntil,
      sessionStartTime: this.state.sessionStartTime
    };
  }
  
  /**
   * Force reset (for testing or emergency admin action)
   */
  forceReset(): void {
    console.log('🔧 Emergency circuit breaker force reset');
    this.state = {
      globalAttempts: 0,
      sessionStartTime: Date.now(),
      blockedUntil: null,
      affectedOrders: new Set()
    };
  }
  
  /**
   * Log emergency stop for monitoring
   */
  private logEmergencyStop(): void {
    try {
      // Log to console for immediate visibility
      console.error('🚨 PRODUCTION ALERT: Emergency circuit breaker activated');
      
      // In a real production environment, you would also:
      // - Send alert to monitoring service (e.g., Sentry, DataDog)
      // - Log to audit trail
      // - Notify administrators
      
      // For now, we'll create a custom event for potential monitoring
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('emergency-circuit-breaker-triggered', {
          detail: {
            timestamp: Date.now(),
            globalAttempts: this.state.globalAttempts,
            affectedOrdersCount: this.state.affectedOrders.size
          }
        }));
      }
    } catch (error) {
      console.error('Failed to log emergency stop:', error);
    }
  }
}

// Export singleton instance
export const emergencyCircuitBreaker = EmergencyCircuitBreaker.getInstance();

// Export for testing
export { EmergencyCircuitBreaker };