import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import EnhancedErrorBoundary from "./components/ui/enhanced-error-boundary";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Reports from "./pages/Reports";
import { PaymentSettings } from "./pages/PaymentSettings";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import PublicHome from "./pages/PublicHome";
import ProductDetail from "./pages/ProductDetail";
import CategoryProducts from "./pages/CategoryProducts";
import Promotions from "./pages/Promotions";
import BookingManagement from "./pages/BookingManagement";
import DeliveryPickup from "./pages/DeliveryPickup";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import Categories from "./pages/Categories";
import CustomerPortal from "./pages/CustomerPortal";


import CustomerFavorites from "./pages/CustomerFavorites";
import PurchaseHistory from "./pages/PurchaseHistory";
import PaymentCallback from "./pages/PaymentCallback";
import Unsubscribe from "./pages/Unsubscribe";
import AdminSetup from "./pages/AdminSetup";
import CustomerRegister from "./pages/CustomerRegister";
import CustomerProfile from "./pages/CustomerProfile";
import AuthPage from "./pages/AuthPage";
import AdminAuth from "./pages/admin/AdminAuth";
import AuthRouter from "./components/auth/AuthRouter";
import Cart from "./pages/Cart";
import Booking from "./pages/Booking";

import AuthCallback from "./pages/AuthCallback";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import PasswordResetPage from "./pages/PasswordResetPage";

const queryClient = new QueryClient();

const App = () => (
  <EnhancedErrorBoundary context="Main Application" showErrorDetails={true}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Root route - intelligent authentication routing */}
              <Route path="/" element={<AuthRouter />} />
              
              {/* Public home page for browsing products */}
              <Route path="/home" element={<PublicHome />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/booking" element={<Booking />} />
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
              
              {/* Payment routes */}
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/payment/success" element={<PaymentCallback />} />
              <Route path="/payment/failed" element={<PaymentCallback />} />
              
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
                <Route path="/products" element={<EnhancedErrorBoundary context="Products"><Products /></EnhancedErrorBoundary>} />
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

export default App;
