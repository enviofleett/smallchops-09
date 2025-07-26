import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Reports from "./pages/Reports";
import { PaymentSettings } from "./pages/PaymentSettings";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import Promotions from "./pages/Promotions";
import DeliveryPickup from "./pages/DeliveryPickup";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import CustomerPortal from "./pages/CustomerPortal";
import CustomerFavorites from "./pages/CustomerFavorites";
import PurchaseHistory from "./pages/PurchaseHistory";
import PaymentCallback from "./pages/PaymentCallback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/customer-portal" element={<CustomerPortal />} />
            <Route path="/customer-favorites" element={<CustomerFavorites />} />
            <Route path="/purchase-history" element={<PurchaseHistory />} />
            <Route path="/payment/callback" element={<PaymentCallback />} />
            <Route path="/payment/success" element={<PaymentCallback />} />
            <Route path="/payment/failed" element={<PaymentCallback />} />
            
            {/* Protected routes */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/products" element={<Products />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/delivery-pickup" element={<DeliveryPickup />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/promotions" element={<Promotions />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/payment-settings" element={<PaymentSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
