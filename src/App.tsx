
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import { EmailProductionTest } from "./pages/EmailProductionTest";
import AdminEmailTemplates from "./pages/admin/EmailTemplates";
import { AdminRouteGuard } from "./components/admin/AdminRouteGuard";
import AuthPage from "./pages/AuthPage";
import AdminAuth from "./pages/admin/AdminAuth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import PasswordResetPage from "./pages/PasswordResetPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HelmetProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/admin/auth" element={<AdminAuth />} />
              <Route path="/auth-callback" element={<AuthCallback />} />
              <Route path="/auth/reset" element={<PasswordResetPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/email-test" element={<EmailProductionTest />} />
              <Route 
                path="/admin/email-templates" 
                element={
                  <AdminRouteGuard>
                    <AdminEmailTemplates />
                  </AdminRouteGuard>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </HelmetProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
