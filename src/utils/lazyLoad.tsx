import { lazy, Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

// Enhanced loading component with better UX
const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center min-h-[200px] p-8">
    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
    <p className="text-sm text-muted-foreground">Loading...</p>
  </div>
);

// Fast loading fallback for critical pages
const FastLoader = () => (
  <div className="flex items-center justify-center min-h-[100px]">
    <div className="animate-pulse">
      <div className="h-4 bg-muted rounded w-24"></div>
    </div>
  </div>
);

// Production-ready lazy loading with retry mechanism and better error handling
export function withLazyLoading<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback: ComponentType = LoadingSpinner,
  useFastLoader = false,
  timeout = 15000, // Reduced timeout for better UX
  maxRetries = 3
) {
  const LazyComponent = lazy(() => {
    let retryCount = 0;
    
    const attemptLoad = async (): Promise<{ default: T }> => {
      const startTime = Date.now();
      console.log(`🔄 Loading component (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      try {
        const result = await Promise.race([
          importFunc(),
          new Promise<never>((_, reject) => 
            setTimeout(() => {
              const loadTime = Date.now() - startTime;
              reject(new Error(`Component load timeout after ${loadTime}ms (attempt ${retryCount + 1})`));
            }, timeout)
          )
        ]);
        
        console.log(`✅ Component loaded successfully in ${Date.now() - startTime}ms`);
        return result;
        
      } catch (error) {
        console.error(`❌ Component load failed (attempt ${retryCount + 1}):`, error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // Exponential backoff, max 5s
          console.log(`🔄 Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptLoad();
        }
        
        // Final failure - provide better error context
        const finalError = new Error(`Failed to load component after ${maxRetries + 1} attempts. Last error: ${error.message}`);
        finalError.name = 'ComponentLoadError';
        throw finalError;
      }
    };
    
    return attemptLoad();
  });
  
  return function LazyLoadedComponent(props: any) {
    const FallbackComponent = useFastLoader ? FastLoader : fallback;
    return (
      <Suspense fallback={<FallbackComponent />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Enhanced preload function for critical routes with better error handling
export function preloadRoute(importFunc: () => Promise<any>, priority: 'high' | 'low' = 'low') {
  const preload = async () => {
    try {
      console.log('🚀 Preloading route...');
      const startTime = Date.now();
      await importFunc();
      console.log(`✅ Route preloaded successfully in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.warn('⚠️ Route preload failed:', error);
      // Don't throw - preload failures should be silent
    }
  };
  
  if (priority === 'high') {
    // High priority - load immediately
    preload();
  } else {
    // Low priority - load when idle or after delay
    if ('requestIdleCallback' in window) {
      requestIdleCallback(preload, { timeout: 1000 });
    } else {
      setTimeout(preload, 100);
    }
  }
}

// Fallback error component for critical failures
export const ComponentErrorFallback = ({ error, onRetry }: { error?: Error; onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-[200px] p-8 space-y-4 border border-destructive/20 rounded-lg bg-destructive/5">
    <div className="text-destructive text-center">
      <h3 className="text-lg font-semibold mb-2">Failed to Load Component</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {error?.message || 'This component failed to load properly'}
      </p>
    </div>
    
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    )}
    
    <button
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors text-sm"
    >
      Refresh Page
    </button>
  </div>
);