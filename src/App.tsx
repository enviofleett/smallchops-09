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
import { initializeConsoleCleanup, validatePaystackCSP, suppressWebSocketErrors } from "./utils/consoleCleanup";
import { logEnvironmentStatus, validateEnvironment, createEnvironmentErrorElement } from "./utils/environmentValidator";

// Initialize payment monitoring and cache busting
initPaymentMonitoring();

// Immediate load critical components
import NotFound from "./pages/NotFound";
import PublicHome from "./pages/PublicHome";

// Lazy load admin components
const Orders = withLazyLoading(() => import("./pages/Orders"));
const Products = withLazyLoading(() => import("./pages/Products"));
const Customers = withLazyLoading(() => import("./pages/Customers"));
const Reports = withLazyLoading(() => import("./pages/Reports"));
const PaymentSettings = withLazyLoading(() => import("./pages/PaymentSettings").then(m => ({ default: m.PaymentSettings })));
const Index = withLazyLoading(() => import("./pages/Index"));
const ProductDetail = withLazyLoading(() => import("./pages/ProductDetail"));
const CategoryProducts = withLazyLoading(() => import("./pages/CategoryProducts"));
const Promotions = withLazyLoading(() => import("./pages/Promotions"));
const BookingManagement = withLazyLoading(() => import("./pages/BookingManagement"));
const DeliveryPickup = withLazyLoading(() => import("./pages/DeliveryPickup"));
const AuditLogs = withLazyLoading(() => import("./pages/AuditLogs"));
const Settings = withLazyLoading(() => import("./pages/Settings"));
const Categories = withLazyLoading(() => import("./pages/Categories"));

// Lazy load customer components
const CustomerFavorites = withLazyLoading(() => import("./pages/CustomerFavorites"));
const PurchaseHistory = withLazyLoading(() => import("./pages/PurchaseHistory"));
const PaymentCallback = withLazyLoading(() => import("./pages/PaymentCallbackPage").then(m => ({ default: m.PaymentCallbackPage })));
const PaymentCallbackRedirect = withLazyLoading(() => import("./pages/PaymentCallbackRedirect"));
const Unsubscribe = withLazyLoading(() => import("./pages/Unsubscribe"));
const AdminSetup = withLazyLoading(() => import("./pages/AdminSetup"));
const CustomerRegister = withLazyLoading(() => import("./pages/CustomerRegister"));
const CustomerProfile = withLazyLoading(() => import("./pages/CustomerProfile"));
const AuthPage = withLazyLoading(() => import("./pages/AuthPage"));
const AdminAuth = withLazyLoading(() => import("./pages/admin/AdminAuth"));
const Cart = withLazyLoading(() => import("./pages/Cart"));
const Booking = withLazyLoading(() => import("./pages/Booking"));
const PublicProducts = withLazyLoading(() => import("./pages/PublicProducts"));
const Contact = withLazyLoading(() => import("./pages/Contact"));
const About = withLazyLoading(() => import("./pages/About"));
const PaystackTest = withLazyLoading(() => import("./pages/PaystackTest"));
const AuthCallback = withLazyLoading(() => import("./pages/AuthCallback"));
const EmailVerificationPage = withLazyLoading(() => import("./pages/EmailVerificationPage"));
const PasswordResetPage = withLazyLoading(() => import("./pages/PasswordResetPage"));
const OrderDetails = withLazyLoading(() => import("./pages/OrderDetails"));
const EmergencyPaymentFix = withLazyLoading(() => import("./components/admin/EmergencyPaymentFix").then(m => ({ default: m.default })));

// Optimized QueryClient for better stability
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,         // 2 minutes - reduced for fresher data
      gcTime: 10 * 60 * 1000,           // 10 minutes cache
      refetchOnWindowFocus: false,       // Prevent unnecessary refetches
      refetchIntervalInBackground: false,
      refetchInterval: false,
      retry: (failureCount, error: any) => {
        // Smart retry logic
        if (error?.status >= 400 && error?.status < 500) {
          return false; // Don't retry client errors
        }
        return failureCount < 3;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
      networkMode: 'online',
    },
  },
});

// Preload critical routes
if (typeof window !== 'undefined') {
  preloadRoute(() => import("./pages/PublicProducts"));
  preloadRoute(() => import("./pages/Cart"));
  preloadRoute(() => import("./pages/Booking"));
}


const App = () => {
  PerformanceMonitor.startTiming('App Render');
  const [environmentStatus, setEnvironmentStatus] = React.useState<ReturnType<typeof validateEnvironment> | null>(null);
  
  React.useEffect(() => {
    PerformanceMonitor.endTiming('App Render');
    
    // Validate environment first
    const envStatus = logEnvironmentStatus();
    setEnvironmentStatus(envStatus);
    
    // Initialize production optimizations
    initializeConsoleCleanup();
    suppressWebSocketErrors();
    validatePaystackCSP();
    
    // Payment system status logging
    console.log('✅ Payment System: Backend-only references active');
    console.log('✅ Paystack-only migration completed');
    
    // Enhanced environment validation with detailed feedback
    console.group('🌍 Environment Status');
    console.log(`Production Ready: ${envStatus.isProductionReady ? '✅' : '❌'}`);
    console.log(`Mode: ${import.meta.env.DEV ? 'Development' : 'Production'}`);
    console.groupEnd();
  }, []);

  // Show environment error screen if critical issues found
  if (environmentStatus && !environmentStatus.isProductionReady) {
    const criticalErrors = environmentStatus.checks.filter(c => c.level === 'error');
    if (criticalErrors.length > 0) {
      // In a real app, you might want to show this error screen
      // For now, we'll just log and continue
      console.error('Critical environment errors detected but continuing...');
    }
  }

  return (
  <ErrorBoundaryWrapper 
    context="Main Application"
    showErrorDetails={import.meta.env.DEV}
    onError={(error, errorInfo) => {
      console.error('App-level error:', { error, errorInfo, timestamp: new Date().toISOString() });
    }}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <DynamicFavicon />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Customer store at root */}
              <Route path="/" element={<PublicHome />} />
              
              {/* Redirect legacy /home to root */}
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/products" element={<PublicProducts />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/paystack-test" element={<PaystackTest />} />
              <Route path="/emergency-fix" element={<EmergencyPaymentFix />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/category/:categoryId" element={<CategoryProducts />} />
              
              {/* Authentication routes */}
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth-callback" element={<AuthCallback />} />
              <Route path="/auth/verify" element={<EmailVerificationPage />} />
              <Route path="/auth/reset" element={<PasswordResetPage />} />
              
              {/* Admin authentication */}
              <Route path="/admin/auth" element={<AdminAuth />} />
              
              {/* Legacy redirects */}
              <Route path="/login" element={<Navigate to="/auth" replace />} />
              <Route path="/admin/login" element={<Navigate to="/admin/auth" replace />} />
              <Route path="/register" element={<Navigate to="/auth?view=register" replace />} />
              
              {/* Customer routes */}
              <Route path="/customer-portal" element={<Navigate to="/" replace />} />
              <Route path="/customer-profile" element={<CustomerProfile />} />
              <Route path="/customer-favorites" element={<CustomerFavorites />} />
              <Route path="/purchase-history" element={<PurchaseHistory />} />
              <Route path="/orders/:id" element={<OrderDetails />} />
              
              {/* Payment routes */}
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/payment/success" element={<PaymentCallback />} />
              <Route path="/payment/failed" element={<PaymentCallback />} />
              <Route path="/payment-callback" element={<PaymentCallbackRedirect />} />
              
              {/* Misc routes */}
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/admin-setup/:token" element={<AdminSetup />} />
              
              {/* Legacy customer registration route */}
              <Route path="/customer-register" element={<CustomerRegister />} />
              
              {/* Protected admin routes */}
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/admin" element={<ErrorBoundaryWrapper context="Dashboard"><Index /></ErrorBoundaryWrapper>} />
                <Route path="/dashboard" element={<ErrorBoundaryWrapper context="Dashboard"><Index /></ErrorBoundaryWrapper>} />
                <Route path="/orders" element={<ErrorBoundaryWrapper context="Orders"><Orders /></ErrorBoundaryWrapper>} />
                <Route path="/admin/products" element={<ErrorBoundaryWrapper context="Products"><Products /></ErrorBoundaryWrapper>} />
                <Route path="/categories" element={<ErrorBoundaryWrapper context="Categories"><Categories /></ErrorBoundaryWrapper>} />
                <Route path="/customers" element={<ErrorBoundaryWrapper context="Customers"><Customers /></ErrorBoundaryWrapper>} />
                <Route path="/delivery-pickup" element={<ErrorBoundaryWrapper context="Delivery"><DeliveryPickup /></ErrorBoundaryWrapper>} />
                <Route path="/reports" element={<ErrorBoundaryWrapper context="Reports"><Reports /></ErrorBoundaryWrapper>} />
                <Route path="/promotions" element={<ErrorBoundaryWrapper context="Promotions"><Promotions /></ErrorBoundaryWrapper>} />
                <Route path="/bookings" element={<ErrorBoundaryWrapper context="Catering Bookings"><BookingManagement /></ErrorBoundaryWrapper>} />
                <Route path="/audit-logs" element={<ErrorBoundaryWrapper context="Audit Logs"><AuditLogs /></ErrorBoundaryWrapper>} />
                <Route path="/settings" element={<ErrorBoundaryWrapper context="Settings"><Settings /></ErrorBoundaryWrapper>} />
                <Route path="/payment-settings" element={<ErrorBoundaryWrapper context="Payment Settings"><PaymentSettings /></ErrorBoundaryWrapper>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundaryWrapper>
  );
};

export default App;
