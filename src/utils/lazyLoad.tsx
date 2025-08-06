import { lazy, Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

// Generic loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Higher-order component for lazy loading with suspense
export function withLazyLoading<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback: ComponentType = LoadingSpinner
) {
  const LazyComponent = lazy(importFunc);
  
  return function LazyLoadedComponent(props: any) {
    const FallbackComponent = fallback;
    return (
      <Suspense fallback={<FallbackComponent />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Preload function for critical routes
export function preloadRoute(importFunc: () => Promise<any>) {
  // Preload on idle or after a short delay
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => importFunc());
  } else {
    setTimeout(() => importFunc(), 100);
  }
}