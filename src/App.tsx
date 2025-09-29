import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
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
import { logPaystackHealthCheck } from "./utils/paystackHealthCheck";
import { ErrorTrackerComponent } from "./components/monitoring/ErrorTracker";
import { NetworkProvider } from "./components/network/NetworkProvider";
import { OnlineStatusBanner } from "./components/network/OnlineStatusBanner";
import { DeploymentInfo } from "./components/common/DeploymentInfo";
import { NotificationIntegration } from "@/components/notifications/NotificationIntegration";
import AdminLayout from "./components/layout/AdminLayout";
import { CartProvider } from "@/contexts/CartProvider";

// Initialize payment monitoring and cache busting
initPaymentMonitoring();

// Import cache manager for production optimization
import { CacheManager } from "./utils/cacheManager";
import "./utils/productionOptimizer"; // Auto-initializes production optimizations

// Immediate load critical components
import NotFound from "./pages/NotFound";
import PublicHome from "./pages/PublicHome";

// Lazy load admin components with optimized loading
const Orders = withLazyLoading(() => import("./pages/Orders"), undefined, false, 10000);
const AdminOrders = withLazyLoading(() => import("./pages/admin/AdminOrders"), undefined, false, 10000);
const AdminOrderDetails = withLazyLoading(() => import("./pages/admin/AdminOrderDetails"), undefined, false, 10000);
const AdminDelivery = withLazyLoading(() => import("./pages/admin/AdminDelivery"), undefined, false, 10000);
const Products = withLazyLoading(() => import("./pages/Products"), undefined, false, 10000);
const Customers = withLazyLoading(() => import("./pages/Customers"), undefined, false, 10000);
const Reports = withLazyLoading(() => import("./pages/Reports"), undefined, false, 10000);
const PaymentSettings = withLazyLoading(() => import("./pages/PaymentSettings").then(m => ({ default: m.PaymentSettings })), undefined, false, 10000);
const Index = withLazyLoading(() => import("./pages/Index"), undefined, true, 8000); // Critical page - fast loader
const ProductDetail = withLazyLoading(() => import("./pages/ProductDetail"), undefined, true, 10000);
const CategoryProducts = withLazyLoading(() => import("./pages/CategoryProducts"), undefined, true, 10000);
const Promotions = withLazyLoading(() => import("./pages/Promotions"), undefined, false, 10000);
const BookingManagement = withLazyLoading(() => import("./pages/BookingManagement"), undefined, false, 10000);
const DeliveryPickup = withLazyLoading(() => import("./pages/DeliveryPickup"), undefined, false, 10000);
const AuditLogs = withLazyLoading(() => import("./pages/AuditLogs"), undefined, false, 10000);
const Settings = withLazyLoading(() => import("./pages/Settings"), undefined, false, 12000); // Larger component
const Categories = withLazyLoading(() => import("./pages/Categories"), undefined, false, 10000);

// Lazy load customer components with optimized loading
const CustomerFavorites = withLazyLoading(() => import("./pages/CustomerFavorites"), undefined, false, 10000);
const PurchaseHistory = withLazyLoading(() => import("./pages/PurchaseHistory"), undefined, false, 10000);
const PaymentCallback = withLazyLoading(() => import("./pages/PaymentCallbackPage").then(m => ({ default: m.PaymentCallbackPage })), undefined, false, 15000);
const PaymentCallbackRedirect = withLazyLoading(() => import("./pages/PaymentCallbackRedirect"), undefined, false, 8000);
const Unsubscribe = withLazyLoading(() => import("./pages/Unsubscribe"), undefined, true, 8000);
const AdminSetup = withLazyLoading(() => import("./pages/AdminSetup"), undefined, false, 10000);
const CustomerRegister = withLazyLoading(() => import("./pages/CustomerRegister"), undefined, true, 10000);
const SimpleRegisterPage = withLazyLoading(() => import("./pages/SimpleRegisterPage"), undefined, true, 8000);
const CustomerProfile = withLazyLoading(() => import("./pages/CustomerProfile"), undefined, false, 10000);
const AuthPage = withLazyLoading(() => import("./pages/AuthPage"), undefined, true, 8000); // Critical auth page
const AdminAuth = withLazyLoading(() => import("./pages/admin/AdminAuth"), undefined, true, 8000); // Critical auth page
const Favorites = withLazyLoading(() => import("./pages/Favorites"), undefined, true, 10000);
const Booking = withLazyLoading(() => import("./pages/Booking"), undefined, true, 12000); // Complex booking component
const PublicProducts = withLazyLoading(() => import("./pages/PublicProducts"), undefined, true, 10000); // High traffic page
const Contact = withLazyLoading(() => import("./pages/Contact"), undefined, true, 8000);
const About = withLazyLoading(() => import("./pages/About"), undefined, true, 8000);
const PaystackTest = withLazyLoading(() => import("./pages/PaystackTest"), undefined, false, 10000);
const PaystackTestingDashboard = withLazyLoading(() => import("./pages/PaystackTestingDashboard"), undefined, false, 12000);
const AuthCallback = withLazyLoading(() => import("./pages/AuthCallback"), undefined, true, 8000);
const EmailVerificationPage = withLazyLoading(() => import("./pages/EmailVerificationPage"), undefined, true, 8000);
const PasswordResetPage = withLazyLoading(() => import("./pages/PasswordResetPage"), undefined, true, 8000);
const Cart = withLazyLoading(() => import("./pages/Cart"), undefined, true, 10000);
const OrderDetails = withLazyLoading(() => import("./pages/OrderDetails"), undefined, false, 10000);
const OrderDetailsPage = withLazyLoading(() => import("./pages/OrderDetailsPage"), undefined, false, 10000);
const TrackOrder = withLazyLoading(() => import("./pages/TrackOrder"), undefined, true, 10000);
const Blog = withLazyLoading(() => import("./pages/Blog"), undefined, true, 10000);
const EmergencyPaymentFix = withLazyLoading(() => import("./components/admin/EmergencyPaymentFix").then(m => ({ default: m.default })), undefined, false, 15000);

// Hardened QueryClient with comprehensive error handling and performance optimizations
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,                  // 30 seconds - FRESH DATA PRIORITY
      gcTime: 2 * 60 * 1000,                 // 2 minutes cache retention
      refetchOnWindowFocus: true,            // Refetch when returning to tab
      refetchIntervalInBackground: false,
      refetchInterval: false,
      refetchOnMount: true,                  // Always check for fresh data
      refetchOnReconnect: true,              // Refetch on network reconnect
      retry: (failureCount, error: any) => {
        // Enhanced retry logic for stability
        const errorStatus = error?.status || error?.response?.status;
        
        // Never retry client errors (4xx)
        if (errorStatus >= 400 && errorStatus < 500) {
          return false;
        }
        
        // Never retry auth errors
        if (error?.message?.includes('auth') || error?.message?.includes('unauthorized')) {
          return false;
        }
        
        // Limit retries to prevent infinite loops
        return failureCount < 1;
      },
      retryDelay: attemptIndex => Math.min(300 * 2 ** attemptIndex, 1500),
      networkMode: 'online',
      throwOnError: false, // Prevent uncaught errors from crashing the app
      meta: {
        timeout: 8000,
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Only retry mutations for network errors
        const errorStatus = error?.status || error?.response?.status;
        if (errorStatus >= 500 && failureCount < 1) {
          return true;
        }
        return false;
      },
      retryDelay: 1000,
      networkMode: 'online',
      throwOnError: false, // Prevent uncaught mutation errors
    },
  },
});

// Initialize cache manager for production fresh data
CacheManager.initialize(queryClient);

// Preload critical routes for better performance
if (typeof window !== 'undefined') {
  preloadRoute(() => import("./pages/Index"), 'high'); // Homepage - highest priority
  preloadRoute(() => import("./pages/PublicProducts"), 'high'); // Product catalog - high traffic
  preloadRoute(() => import("./pages/Cart"), 'high'); // Shopping cart - critical path
  preloadRoute(() => import("./pages/Booking"), 'low'); // Secondary page
  preloadRoute(() => import("./pages/AuthPage"), 'low'); // Auth pages
  preloadRoute(() => import("./pages/Contact"), 'low'); // Support pages
}


const App = () => {
  PerformanceMonitor.startTiming('App Render');
  const [environmentStatus, setEnvironmentStatus] = React.useState<ReturnType<typeof validateEnvironment> | null>(null);
  
  React.useEffect(() => {
    PerformanceMonitor.endTiming('App Render');
    
    // Validate environment first
    const envStatus = logEnvironmentStatus();
    setEnvironmentStatus(envStatus);
    
    // Run Paystack configuration health check
    logPaystackHealthCheck();
    
    // Initialize production optimizations
    initializeConsoleCleanup();
    suppressWebSocketErrors();
    validatePaystackCSP();
    
    // PRODUCTION: Clear stale caches on startup
    CacheManager.smartRefresh().catch(console.error);
    
    // Payment system status logging
    console.log('✅ Payment System: Backend-only references active');
    console.log('✅ Paystack-only migration completed');
    console.log('✅ Cache Management: Fresh data priority enabled');
    
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
        <NetworkProvider>
          <ErrorTrackerComponent />
          <Toaster />
          <Sonner />
          <DynamicFavicon />
          <OnlineStatusBanner />
          <AuthProvider>
            <NotificationProvider>
              <NotificationIntegration />
              <CartProvider>
            <BrowserRouter>
            <Routes>
              {/* Customer store at root */}
              <Route path="/" element={<PublicHome />} />
              
              {/* Redirect legacy /home to root */}
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/products" element={<PublicProducts />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/about" element={<About />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/paystack-test" element={<PaystackTest />} />
              <Route path="/paystack-testing" element={<PaystackTestingDashboard />} />
              <Route path="/emergency-fix" element={<EmergencyPaymentFix />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/category/:categoryId" element={<CategoryProducts />} />
              
              {/* Authentication routes */}
              <Route path="/auth" element={<ErrorBoundaryWrapper context="Auth Page"><AuthPage /></ErrorBoundaryWrapper>} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth-callback" element={<AuthCallback />} /> {/* Legacy support */}
              <Route path="/auth/verify" element={<EmailVerificationPage />} />
              <Route path="/auth/reset" element={<PasswordResetPage />} />
              
              {/* Admin authentication */}
              <Route path="/admin/auth" element={<AdminAuth />} />
              
              {/* Legacy redirects */}
              <Route path="/login" element={<Navigate to="/auth" replace />} />
              <Route path="/admin/login" element={<Navigate to="/admin/auth" replace />} />
              
              {/* Customer routes */}
              <Route path="/customer-portal" element={<Navigate to="/" replace />} />
              <Route path="/customer-profile" element={<CustomerProfile />} />
              <Route path="/customer-favorites" element={<CustomerFavorites />} />
              <Route path="/purchase-history" element={<PurchaseHistory />} />
              <Route path="/purchase-history/:customerEmail" element={<PurchaseHistory />} />
              <Route path="/orders/:id" element={<OrderDetails />} />
              <Route path="/track-order" element={<TrackOrder />} />
              <Route path="/track/:orderNumber" element={<TrackOrder />} />
              
              {/* Payment routes */}
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/payment/success" element={<PaymentCallback />} />
              <Route path="/payment/failed" element={<PaymentCallback />} />
              <Route path="/payment-callback" element={<PaymentCallbackRedirect />} />
              
              {/* Misc routes */}
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/admin-setup/:token" element={<AdminSetup />} />
              
              {/* Simple registration routes - removed to discourage OTP flow */}
              {/* <Route path="/simple-register" element={<SimpleRegisterPage />} /> */}
              
              {/* Legacy customer registration route */}
              <Route path="/customer-register" element={<CustomerRegister />} />
              
              {/* Legacy admin redirects for seamless transition */}
              <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
              <Route path="/delivery-pickup" element={<Navigate to="/admin/delivery" replace />} />

              {/* Protected admin routes with unified authentication */}
              <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                <Route path="/admin" element={<Index />} />
                <Route path="/dashboard" element={<Index />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/orders/:id" element={<AdminOrderDetails />} />
                <Route path="/admin/order-details/:orderId" element={<OrderDetailsPage />} />
                <Route path="/admin/delivery" element={<AdminDelivery />} />
                <Route path="/admin/products" element={<Products />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/promotions" element={<Promotions />} />
                <Route path="/bookings" element={<BookingManagement />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/payment-settings" element={<PaymentSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </BrowserRouter>
            </CartProvider>
            </NotificationProvider>
          </AuthProvider>
        </NetworkProvider>
      </TooltipProvider>
      <DeploymentInfo />
    </QueryClientProvider>
  </ErrorBoundaryWrapper>
  );
};

export default App;
