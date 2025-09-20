// Performance optimization utilities for production stability

class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private isProduction = process.env.NODE_ENV === 'production';
  
  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  // Safe console logging that doesn't impact production
  log(...args: any[]) {
    if (!this.isProduction) {
      console.log(...args);
    }
  }

  warn(...args: any[]) {
    if (!this.isProduction) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    // Always log errors, but limit in production
    if (this.isProduction) {
      console.error(args[0]); // Only first argument in production
    } else {
      console.error(...args);
    }
  }

  // Debounced function wrapper
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Throttled function wrapper
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Memory-safe array operations
  safePush<T>(array: T[], item: T, maxLength: number = 1000): T[] {
    const newArray = [...array, item];
    return newArray.length > maxLength ? newArray.slice(-maxLength) : newArray;
  }

  // Check if animations should be reduced for performance
  shouldReduceAnimations(): boolean {
    if (typeof window === 'undefined') return false;
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaQuery.matches || this.isLowEndDevice();
  }

  // Detect low-end devices
  private isLowEndDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    
    // Check for limited memory (< 2GB)
    const memory = (navigator as any).deviceMemory;
    if (memory && memory < 2) return true;

    // Check for slow CPU (< 2 cores)
    const cores = navigator.hardwareConcurrency;
    if (cores && cores < 2) return true;

    return false;
  }

  // Optimize images for performance
  getOptimizedImageProps(src: string, alt: string) {
    return {
      src,
      alt,
      loading: 'lazy' as const,
      decoding: 'async' as const,
      fetchPriority: 'low' as const
    };
  }

  // Critical images that should load immediately
  getCriticalImageProps(src: string, alt: string) {
    return {
      src,
      alt,
      loading: 'eager' as const,
      decoding: 'sync' as const,
      fetchPriority: 'high' as const
    };
  }
}

export const performanceOptimizer = PerformanceOptimizer.getInstance();
export default performanceOptimizer;