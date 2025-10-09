/**
 * Navigation throttling utility to prevent excessive navigation events
 * Addresses Chrome's navigation throttling warnings
 */

interface NavigationRequest {
  path: string;
  timestamp: number;
}

class NavigationThrottle {
  private lastNavigation: NavigationRequest | null = null;
  private readonly minInterval: number = 100; // Minimum 100ms between navigations
  private pendingNavigation: NodeJS.Timeout | null = null;

  /**
   * Check if navigation should be allowed
   * @param path - The path to navigate to
   * @returns true if navigation is allowed, false if it should be throttled
   */
  shouldNavigate(path: string): boolean {
    const now = Date.now();
    
    // If this is the same path as last navigation, skip it
    if (this.lastNavigation && this.lastNavigation.path === path) {
      console.log(`🚫 Navigation throttled: Already at ${path}`);
      return false;
    }

    // If enough time has passed, allow navigation
    if (!this.lastNavigation || (now - this.lastNavigation.timestamp) >= this.minInterval) {
      this.lastNavigation = { path, timestamp: now };
      return true;
    }

    // Too soon, throttle it
    console.log(`⏱️ Navigation throttled: Too soon (${now - this.lastNavigation.timestamp}ms < ${this.minInterval}ms)`);
    return false;
  }

  /**
   * Schedule a navigation with debouncing
   * @param path - The path to navigate to
   * @param callback - The navigation function to call
   */
  scheduleNavigation(path: string, callback: () => void): void {
    // Clear any pending navigation
    if (this.pendingNavigation) {
      clearTimeout(this.pendingNavigation);
    }

    // Schedule the navigation
    this.pendingNavigation = setTimeout(() => {
      if (this.shouldNavigate(path)) {
        callback();
      }
      this.pendingNavigation = null;
    }, this.minInterval);
  }

  /**
   * Reset the throttle state
   */
  reset(): void {
    this.lastNavigation = null;
    if (this.pendingNavigation) {
      clearTimeout(this.pendingNavigation);
      this.pendingNavigation = null;
    }
  }
}

// Export singleton instance
export const navigationThrottle = new NavigationThrottle();

/**
 * Hook to use navigation throttling
 */
export const useNavigationThrottle = () => {
  return {
    shouldNavigate: navigationThrottle.shouldNavigate.bind(navigationThrottle),
    scheduleNavigation: navigationThrottle.scheduleNavigation.bind(navigationThrottle),
    reset: navigationThrottle.reset.bind(navigationThrottle),
  };
};
