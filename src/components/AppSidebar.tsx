import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import ErrorBoundaryWrapper from "./components/ErrorBoundaryWrapper";
import { withLazyLoading, preloadRoute } from "./utils/lazyLoad";
import { FullPageLoader } from "./components/ui/page-loader";
import { PerformanceMonitor } from "./utils/performance";
import { initPaymentMonitoring } from "./utils/paymentMonitoring";
import DynamicFavicon from "./components/seo/DynamicFavicon";
import { 
  initializeConsoleCleanup, 
  validatePaystackCSP, 
  suppressWebSocketErrors 
} from "./utils/consoleCleanup";
import { 
  logEnvironmentStatus, 
  validateEnvironment 
} from "./utils/environmentValidator";

// Initialize monitoring systems
initPaymentMonitoring();

// Immediate load critical components
const NotFound = React.lazy(() => import("./pages/NotFound"));
const PublicHome = React.lazy(() => import("./pages/PublicHome"));

// Type for lazy-loaded components
interface LazyComponent {
  default: React.ComponentType;
}

// Lazy load components with proper typing
const lazyLoad = <T extends LazyComponent>(
  factory: () => Promise<T>,
  fallback?: React.ReactNode
) => {
  const LazyComponent = React.lazy(factory);
  return (props: React.ComponentProps<typeof LazyComponent>) => (
    <Suspense fallback={fallback || <FullPageLoader />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

// Admin components
const AdminOrders = lazyLoad(() => import("./pages/admin/AdminOrders"));
const AdminDelivery = lazyLoad(() => import("./pages/admin/AdminDelivery"));
const Products = lazyLoad(() => import("./pages/Products"));
const Categories = lazyLoad(() => import("./pages/Categories"));

// Customer components
const CustomerProfile = lazyLoad(() => import("./pages/CustomerProfile"));
const Cart = lazyLoad(() => import("./pages/Cart"));
const Booking = lazyLoad(() => import("./pages/Booking"));

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

// Preload critical customer-facing routes
if (typeof window !== 'undefined') {
  preloadRoute(() => import("./pages/Cart"));
  preloadRoute(() => import("./pages/Booking"));
}

const App = () => {
  const [envReady, setEnvReady] = React.useState(true);
  
  React.useEffect(() => {
    PerformanceMonitor.startTiming('App Mount');
    
    // Validate environment
    const envStatus = validateEnvironment();
    if (!envStatus.isProductionReady) {
      console.error('Environment issues:', envStatus.checks);
      setEnvReady(false);
    }

    // Initialize production optimizations
    if (import.meta.env.PROD) {
      initializeConsoleCleanup();
      suppressWebSocketErrors();
      validatePaystackCSP();
    }

    PerformanceMonitor.endTiming('App Mount');
    return () => PerformanceMonitor.clear('App Mount');
  }, []);

  if (!envReady) {
    return (
      <div className="grid place-items-center h-screen bg-background text-foreground p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">System Maintenance</h1>
          <p className="mb-4">
            We're currently performing system checks. Please try again shortly.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundaryWrapper 
      context="Main Application"
      fallback={
        <div className="grid place-items-center h-screen">
          <div className="text-center p-6 max-w-md">
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="mb-4">Please try refreshing the page</p>
            {import.meta.env.DEV && (
              <details className="text-left text-sm">
                <summary>Technical Details</summary>
                <div className="mt-2 p-2 bg-muted rounded">
                  Check browser console for error details
                </div>
              </details>
            )}
          </div>
        </div>
      }
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <Toaster />
          <Sonner position="top-center" />
          <DynamicFavicon />
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={
                  <Suspense fallback={<FullPageLoader />}>
                    <PublicHome />
                  </Suspense>
                } />
                
                <Route path="/products" element={
                  <ErrorBoundaryWrapper context="Public Products">
                    <Suspense fallback={<FullPageLoader />}>
                      <PublicProducts />
                    </Suspense>
                  </ErrorBoundaryWrapper>
                } />

                {/* Customer routes */}
                <Route path="/cart" element={
                  <ErrorBoundaryWrapper context="Cart">
                    <Cart />
                  </ErrorBoundaryWrapper>
                } />

                {/* Admin routes */}
                <Route element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route path="/admin" element={
                    <ErrorBoundaryWrapper context="Dashboard">
                      <Index />
                    </ErrorBoundaryWrapper>
                  } />
                  
                  <Route path="/admin/products" element={
                    <ErrorBoundaryWrapper context="Admin Products">
                      <Products />
                    </ErrorBoundaryWrapper>
                  } />
                </Route>

                {/* 404 */}
                <Route path="*" element={
                  <Suspense fallback={<FullPageLoader />}>
                    <NotFound />
                  </Suspense>
                } />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundaryWrapper>
  );
};

export default React.memo(App);
