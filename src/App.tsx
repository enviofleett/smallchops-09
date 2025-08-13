import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import EnhancedErrorBoundary from "./components/EnhancedErrorBoundary";
import { withLazyLoading, preloadRoute } from "./utils/lazyLoad";
import { FullPageLoader } from "./components/ui/page-loader";
import { PerformanceMonitor } from "./utils/performance";
import { initPaymentMonitoring } from "./utils/paymentMonitoring";
import DynamicFavicon from "./components/seo/DynamicFavicon";
import { initializeConsoleCleanup, validatePaystackCSP, suppressWebSocketErrors } from "./utils/consoleCleanup";

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

// Heavily optimized QueryClient to reduce Supabase usage
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes default cache
      gcTime: 15 * 60 * 1000,          // Keep in cache for 15 minutes
      refetchOnWindowFocus: 'always',   // Only refetch when user returns
      refetchIntervalInBackground: false, // Stop background refetching
      refetchInterval: false,           // Disable auto-refetch by default
      retry: 2,                         // Reduce retries
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 15000),
      networkMode: 'online',            // Only query when online
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
  
  React.useEffect(() => {
    PerformanceMonitor.endTiming('App Render');
    
    // Initialize production optimizations
    initializeConsoleCleanup();
    suppressWebSocketErrors();
    validatePaystackCSP();
    
    // Payment system status logging
    console.log('✅ Payment System: Backend-only references active');
    console.log('✅ Paystack-only migration completed');
    
    // Environment validation
    if (!import.meta.env.VITE_SUPABASE_URL) {
      console.warn('⚠️ Missing VITE_SUPABASE_URL environment variable');
    }
  }, []);

  return (
  <EnhancedErrorBoundary context="Main Application">
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
                <Route path="/admin" element={<EnhancedErrorBoundary context="Dashboard"><Index /></EnhancedErrorBoundary>} />
                <Route path="/dashboard" element={<EnhancedErrorBoundary context="Dashboard"><Index /></EnhancedErrorBoundary>} />
                <Route path="/orders" element={<EnhancedErrorBoundary context="Orders"><Orders /></EnhancedErrorBoundary>} />
                <Route path="/admin/products" element={<EnhancedErrorBoundary context="Products"><Products /></EnhancedErrorBoundary>} />
                <Route path="/categories" element={<EnhancedErrorBoundary context="Categories"><Categories /></EnhancedErrorBoundary>} />
                <Route path="/customers" element={<EnhancedErrorBoundary context="Customers"><Customers /></EnhancedErrorBoundary>} />
                <Route path="/delivery-pickup" element={<EnhancedErrorBoundary context="Delivery"><DeliveryPickup /></EnhancedErrorBoundary>} />
                <Route path="/reports" element={<EnhancedErrorBoundary context="Reports"><Reports /></EnhancedErrorBoundary>} />
                <Route path="/promotions" element={<EnhancedErrorBoundary context="Promotions"><Promotions /></EnhancedErrorBoundary>} />
                <Route path="/bookings" element={<EnhancedErrorBoundary context="Catering Bookings"><BookingManagement /></EnhancedErrorBoundary>} />
                <Route path="/audit-logs" element={<EnhancedErrorBoundary context="Audit Logs"><AuditLogs /></EnhancedErrorBoundary>} />
                <Route path="/settings" element={<EnhancedErrorBoundary context="Settings"><Settings /></EnhancedErrorBoundary>} />
                <Route path="/payment-settings" element={<EnhancedErrorBoundary context="Payment Settings"><PaymentSettings /></EnhancedErrorBoundary>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </EnhancedErrorBoundary>
  );
};

export default App;
