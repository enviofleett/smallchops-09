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

import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import Promotions from "./pages/Promotions";
import DeliveryPickup from "./pages/DeliveryPickup";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import CustomerPortal from "./pages/CustomerPortal";
import CustomerFavorites from "./pages/CustomerFavorites";
import PurchaseHistory from "./pages/PurchaseHistory";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
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
              <Route path="*" element={<NotFound />} />
            </Route>
            {/* Public Customer Portal */}
            <Route path="/customer-portal" element={<CustomerPortal />} />
            <Route path="/favorites" element={<CustomerFavorites />} />
            <Route path="/purchase-history/:customerEmail" element={<PurchaseHistory />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
