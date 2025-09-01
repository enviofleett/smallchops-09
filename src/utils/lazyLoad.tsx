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

// Higher-order component for lazy loading with enhanced error handling
export function withLazyLoading<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback: ComponentType = LoadingSpinner,
  useFastLoader = false,
  timeout = 30000 // Increased timeout for large components
) {
  const LazyComponent = lazy(() => {
    const startTime = Date.now();
    
    return Promise.race([
      importFunc().catch((error) => {
        console.error('Component import failed:', error);
        throw error;
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => {
          const loadTime = Date.now() - startTime;
          console.warn(`Component load timeout after ${loadTime}ms`);
          reject(new Error(`Component load timeout after ${loadTime}ms`));
        }, timeout)
      )
    ]);
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

// Enhanced preload function for critical routes
export function preloadRoute(importFunc: () => Promise<any>) {
  // Preload on idle or after a short delay with error handling
  const preload = () => {
    importFunc().catch(error => {
      console.warn('Route preload failed:', error);
    });
  };
  
  if ('requestIdleCallback' in window) {
    requestIdleCallback(preload, { timeout: 2000 });
  } else {
    setTimeout(preload, 50); // Faster preload
  }
}