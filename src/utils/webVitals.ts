// Web Vitals monitoring for production
export interface WebVitalsMetric {
  name: 'FCP' | 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP';
  value: number;
  id: string;
  delta: number;
}

export class WebVitals {
  private static metrics: Map<string, number> = new Map();

  static reportWebVitals(metric: WebVitalsMetric) {
    try {
      // Ensure metrics Map is initialized
      if (!WebVitals.metrics) {
        WebVitals.metrics = new Map();
      }
      
      // Store metric safely
      WebVitals.metrics.set(metric.name, metric.value);

      // Log in development
      if (import.meta.env.DEV) {
        console.log(`📊 ${metric.name}: ${metric.value}ms`);
      }

      // Send to analytics in production
      if (import.meta.env.PROD) {
        WebVitals.sendToAnalytics(metric);
      }
    } catch (error) {
      console.warn('Error reporting web vitals:', error);
    }
  }

  private static sendToAnalytics(metric: WebVitalsMetric) {
    try {
      // Send to your analytics service
      // Example: Google Analytics 4
      if (typeof window !== 'undefined' && 'gtag' in window) {
        const gtag = (window as any).gtag;
        gtag('event', metric.name, {
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          event_category: 'Web Vitals',
          event_label: metric.id,
          non_interaction: true,
        });
      }
    } catch (error) {
      console.warn('Error sending analytics:', error);
    }
  }

  static getMetrics() {
    try {
      return WebVitals.metrics ? (Object.fromEntries(WebVitals.metrics) as Record<string, number>) : {};
    } catch (error) {
      console.warn('Error getting metrics:', error);
      return {};
    }
  }
}

// Initialize web vitals if available
export async function initWebVitals() {
  if (import.meta.env.PROD) {
    try {
      const webVitalsModule = await import('web-vitals');
      
      // Safely call web vitals functions
      if (webVitalsModule?.onCLS) webVitalsModule.onCLS(WebVitals.reportWebVitals);
      if (webVitalsModule?.onINP) webVitalsModule.onINP(WebVitals.reportWebVitals);
      if (webVitalsModule?.onFCP) webVitalsModule.onFCP(WebVitals.reportWebVitals);
      if (webVitalsModule?.onLCP) webVitalsModule.onLCP(WebVitals.reportWebVitals);
      if (webVitalsModule?.onTTFB) webVitalsModule.onTTFB(WebVitals.reportWebVitals);
    } catch (error) {
      console.warn('Web Vitals not available:', error);
    }
  }
}