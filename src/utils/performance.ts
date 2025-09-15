// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics: Map<string, number> = new Map();
  
  static startTiming(label: string): void {
    this.metrics.set(label, performance.now());
  }
  
  static endTiming(label: string): number {
    const start = this.metrics.get(label);
    if (!start) return 0;
    
    const duration = performance.now() - start;
    this.metrics.delete(label);
    
    // Log in development
    if (import.meta.env.DEV) {
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
  
  static measureComponent<T extends any[]>(
    name: string,
    fn: (...args: T) => any
  ) {
    return (...args: T) => {
      this.startTiming(name);
      const result = fn(...args);
      this.endTiming(name);
      return result;
    };
  }
}

// Image optimization utilities
export class ImageOptimizer {
  static optimizeImageUrl(url: string, width?: number, quality: number = 80): string {
    if (!url || url.startsWith('data:')) return url;
    
    // For Supabase storage URLs, avoid adding optimization parameters that may not be supported
    // Just return the original URL to ensure compatibility
    if (url.includes('supabase.co/storage')) {
      return url;
    }
    
    return url;
  }
  
  static generateSrcSet(url: string, sizes: number[] = [400, 800, 1200]): string {
    return sizes
      .map(size => `${this.optimizeImageUrl(url, size)} ${size}w`)
      .join(', ');
  }
}

// Caching utilities
export class CacheManager {
  private static cache: Map<string, { data: any; expiry: number }> = new Map();
  
  static set(key: string, data: any, ttlMs: number = 300000): void { // 5 min default
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }
  
  static get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  static clear(): void {
    this.cache.clear();
  }
}

// Resource preloading
export class ResourcePreloader {
  private static preloadedUrls = new Set<string>();
  
  static preloadImage(url: string): void {
    if (this.preloadedUrls.has(url)) return;
    
    const img = new Image();
    img.src = url;
    this.preloadedUrls.add(url);
  }
  
  static preloadImages(urls: string[]): void {
    urls.forEach(url => this.preloadImage(url));
  }
  
  static preloadRoute(routePath: string): void {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = routePath;
    document.head.appendChild(link);
  }
}