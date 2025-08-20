// Traffic Control System - Emergency Usage Management
// Prevents hitting Supabase limits and enables safe project cutover

interface TrafficControlConfig {
  isFreezeModeEnabled: boolean;
  maxEdgeFunctionCallsPerHour: number;
  maxEgressMBPerHour: number;
  enableClientSideOnly: boolean;
  emergencyMode: boolean;
}

class TrafficControlManager {
  private config: TrafficControlConfig;
  private hourlyUsage = {
    edgeFunctionCalls: 0,
    egressMB: 0,
    lastResetTime: Date.now()
  };

  constructor() {
    this.config = {
      isFreezeModeEnabled: false,
      maxEdgeFunctionCallsPerHour: 100, // Very conservative limit
      maxEgressMBPerHour: 50, // Conservative egress limit
      enableClientSideOnly: true, // Force client-side operations
      emergencyMode: false
    };

    // Load from localStorage if available
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    try {
      const saved = localStorage.getItem('traffic_control_config');
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }

      const savedUsage = localStorage.getItem('traffic_control_usage');
      if (savedUsage) {
        const usage = JSON.parse(savedUsage);
        // Only restore if less than 1 hour old
        if (Date.now() - usage.lastResetTime < 3600000) {
          this.hourlyUsage = usage;
        }
      }
    } catch (error) {
      console.warn('Failed to load traffic control config:', error);
    }
  }

  private saveConfiguration(): void {
    try {
      localStorage.setItem('traffic_control_config', JSON.stringify(this.config));
      localStorage.setItem('traffic_control_usage', JSON.stringify(this.hourlyUsage));
    } catch (error) {
      console.warn('Failed to save traffic control config:', error);
    }
  }

  // Emergency freeze - stops all server calls
  enableFreezeMode(): void {
    this.config.isFreezeModeEnabled = true;
    this.config.emergencyMode = true;
    this.config.enableClientSideOnly = true;
    this.saveConfiguration();
    console.warn('🚨 FREEZE MODE ENABLED - All server calls blocked');
  }

  disableFreezeMode(): void {
    this.config.isFreezeModeEnabled = false;
    this.config.emergencyMode = false;
    this.saveConfiguration();
    console.log('✅ Freeze mode disabled');
  }

  // Check if operation is allowed
  canMakeServerCall(estimatedEgressKB: number = 5): boolean {
    this.resetUsageIfNeeded();

    if (this.config.isFreezeModeEnabled) {
      console.warn('🚫 Server call blocked - Freeze mode active');
      return false;
    }

    if (this.config.enableClientSideOnly) {
      console.warn('🚫 Server call blocked - Client-side only mode');
      return false;
    }

    // Check limits
    if (this.hourlyUsage.edgeFunctionCalls >= this.config.maxEdgeFunctionCallsPerHour) {
      console.warn('🚫 Edge function limit reached for this hour');
      return false;
    }

    if (this.hourlyUsage.egressMB >= this.config.maxEgressMBPerHour) {
      console.warn('🚫 Egress limit reached for this hour');
      return false;
    }

    return true;
  }

  // Record usage after a successful call
  recordServerCall(responseKB: number = 5): void {
    this.resetUsageIfNeeded();
    this.hourlyUsage.edgeFunctionCalls++;
    this.hourlyUsage.egressMB += responseKB / 1024;
    this.saveConfiguration();
  }

  private resetUsageIfNeeded(): void {
    const hoursSinceReset = (Date.now() - this.hourlyUsage.lastResetTime) / 3600000;
    if (hoursSinceReset >= 1) {
      this.hourlyUsage = {
        edgeFunctionCalls: 0,
        egressMB: 0,
        lastResetTime: Date.now()
      };
    }
  }

  // Get current usage status
  getUsageStatus(): {
    edgeFunctionCalls: number;
    maxEdgeFunctionCalls: number;
    egressMB: number;
    maxEgressMB: number;
    percentUsed: number;
    isNearLimit: boolean;
    timeToReset: number;
  } {
    this.resetUsageIfNeeded();
    
    const edgePercent = (this.hourlyUsage.edgeFunctionCalls / this.config.maxEdgeFunctionCallsPerHour) * 100;
    const egressPercent = (this.hourlyUsage.egressMB / this.config.maxEgressMBPerHour) * 100;
    const maxPercent = Math.max(edgePercent, egressPercent);
    
    return {
      edgeFunctionCalls: this.hourlyUsage.edgeFunctionCalls,
      maxEdgeFunctionCalls: this.config.maxEdgeFunctionCallsPerHour,
      egressMB: Math.round(this.hourlyUsage.egressMB * 100) / 100,
      maxEgressMB: this.config.maxEgressMBPerHour,
      percentUsed: Math.round(maxPercent),
      isNearLimit: maxPercent > 80,
      timeToReset: 3600000 - (Date.now() - this.hourlyUsage.lastResetTime)
    };
  }

  // Configuration methods
  setLimits(edgeFunctions: number, egressMB: number): void {
    this.config.maxEdgeFunctionCallsPerHour = edgeFunctions;
    this.config.maxEgressMBPerHour = egressMB;
    this.saveConfiguration();
  }

  enableClientSideOnlyMode(enabled: boolean = true): void {
    this.config.enableClientSideOnly = enabled;
    this.saveConfiguration();
    console.log(`Client-side only mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  // Reset all usage counters
  resetUsage(): void {
    this.hourlyUsage = {
      edgeFunctionCalls: 0,
      egressMB: 0,
      lastResetTime: Date.now()
    };
    this.saveConfiguration();
    console.log('📊 Usage counters reset');
  }

  // Emergency shutdown
  emergencyShutdown(): void {
    this.enableFreezeMode();
    this.resetUsage();
    console.error('🚨 EMERGENCY SHUTDOWN ACTIVATED');
  }
}

// Singleton instance
export const trafficControl = new TrafficControlManager();

// Helper functions for easy integration
export const canMakeServerCall = (estimatedKB?: number) => trafficControl.canMakeServerCall(estimatedKB);
export const recordServerCall = (responseKB?: number) => trafficControl.recordServerCall(responseKB);
export const enableFreezeMode = () => trafficControl.enableFreezeMode();
export const disableFreezeMode = () => trafficControl.disableFreezeMode();
export const getUsageStatus = () => trafficControl.getUsageStatus();
export const emergencyShutdown = () => trafficControl.emergencyShutdown();

// Auto-enable freeze mode if localStorage indicates emergency
if (typeof window !== 'undefined') {
  const emergencyFlag = localStorage.getItem('supabase_emergency_mode');
  if (emergencyFlag === 'true') {
    trafficControl.enableFreezeMode();
  }
}