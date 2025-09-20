import { performanceOptimizer } from './performanceOptimizer';

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
}

export interface WebsiteHealth {
  overall: 'healthy' | 'warning' | 'error';
  checks: {
    performance: HealthCheckResult;
    api: HealthCheckResult;
    images: HealthCheckResult;
    animations: HealthCheckResult;
  };
  timestamp: string;
}

class HealthChecker {
  private static instance: HealthChecker;
  
  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  async runFullHealthCheck(): Promise<WebsiteHealth> {
    const startTime = performance.now();
    
    const checks = {
      performance: await this.checkPerformance(),
      api: await this.checkAPI(),
      images: await this.checkImages(),
      animations: await this.checkAnimations()
    };

    const overall = this.determineOverallHealth(checks);
    const endTime = performance.now();

    performanceOptimizer.log(`Health check completed in ${endTime - startTime}ms`);

    return {
      overall,
      checks,
      timestamp: new Date().toISOString()
    };
  }

  private async checkPerformance(): Promise<HealthCheckResult> {
    try {
      // Check for performance issues
      const navigation = performance.getEntriesByType('navigation')[0] as any;
      if (!navigation) {
        return { status: 'warning', message: 'Navigation timing not available' };
      }

      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      
      if (loadTime > 3000) {
        return { 
          status: 'error', 
          message: 'Slow page load detected',
          details: { loadTime }
        };
      } else if (loadTime > 1500) {
        return { 
          status: 'warning', 
          message: 'Page load could be faster',
          details: { loadTime }
        };
      }

      return { 
        status: 'healthy', 
        message: 'Page performance is good',
        details: { loadTime }
      };
    } catch (error) {
      return { status: 'error', message: 'Failed to check performance' };
    }
  }

  private async checkAPI(): Promise<HealthCheckResult> {
    try {
      // Test a simple API call to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/health-check', {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { status: 'healthy', message: 'API connectivity is working' };
      } else {
        return { 
          status: 'warning', 
          message: 'API responded with non-200 status',
          details: { status: response.status }
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { 
          status: 'error', 
          message: 'API request timed out'
        };
      }
      return { 
        status: 'error', 
        message: 'API connectivity failed',
        details: error
      };
    }
  }

  private async checkImages(): Promise<HealthCheckResult> {
    const brokenImages = document.querySelectorAll('img[data-error="true"]');
    const totalImages = document.querySelectorAll('img').length;
    
    if (brokenImages.length === 0) {
      return { 
        status: 'healthy', 
        message: 'All images loading successfully',
        details: { totalImages }
      };
    } else if (brokenImages.length < totalImages * 0.1) {
      return { 
        status: 'warning', 
        message: 'Some images failed to load',
        details: { brokenImages: brokenImages.length, totalImages }
      };
    } else {
      return { 
        status: 'error', 
        message: 'Many images failed to load',
        details: { brokenImages: brokenImages.length, totalImages }
      };
    }
  }

  private async checkAnimations(): Promise<HealthCheckResult> {
    const pulsingElements = document.querySelectorAll('.animate-pulse');
    const visiblePulsingElements = Array.from(pulsingElements).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (visiblePulsingElements.length === 0) {
      return { status: 'healthy', message: 'No flickering animations detected' };
    } else if (visiblePulsingElements.length < 5) {
      return { 
        status: 'warning', 
        message: 'Some loading animations visible',
        details: { count: visiblePulsingElements.length }
      };
    } else {
      return { 
        status: 'error', 
        message: 'Excessive flickering animations detected',
        details: { count: visiblePulsingElements.length }
      };
    }
  }

  private determineOverallHealth(checks: WebsiteHealth['checks']): 'healthy' | 'warning' | 'error' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('error')) {
      return 'error';
    } else if (statuses.includes('warning')) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  // Quick flickering check
  checkForFlickering(): boolean {
    const pulsingElements = document.querySelectorAll('.animate-pulse:not(.skeleton)');
    return pulsingElements.length > 3;
  }

  // Auto-fix common issues
  async autoFixIssues(): Promise<string[]> {
    const fixes: string[] = [];

    // Remove excessive pulse animations
    const excessivePulse = document.querySelectorAll('.animate-pulse:not(.skeleton)');
    if (excessivePulse.length > 10) {
      excessivePulse.forEach(el => el.classList.remove('animate-pulse'));
      fixes.push('Removed excessive pulse animations');
    }

    // Fix broken images
    const brokenImages = document.querySelectorAll('img');
    brokenImages.forEach(img => {
      if (!img.complete || img.naturalWidth === 0) {
        img.style.display = 'none';
        fixes.push('Hidden broken images');
      }
    });

    return fixes;
  }
}

export const healthChecker = HealthChecker.getInstance();
export default healthChecker;