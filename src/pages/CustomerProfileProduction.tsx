import React from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import OrdersSection from '@/components/customer/OrdersSection';
import ProductionErrorBoundary from '@/components/ProductionErrorBoundary';
import ProductionMonitoring from '@/components/ProductionMonitoring';
import ProductionOrdersErrorBoundary from '@/components/customer/ProductionOrdersErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Package, Settings, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CustomerProfileProduction = () => {
  const { user, logout, isLoading, error, customerAccount, refetch } = useCustomerAuth();
  
  // PRODUCTION DEBUGGING: Log current state
  console.log('CustomerProfile State:', {
    hasUser: !!user,
    userEmail: user?.email,
    isLoading,
    error,
    hasCustomerAccount: !!customerAccount,
    timestamp: new Date().toISOString()
  });
  
  const handleSignOut = async () => {
    try {
      await logout();
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
      window.location.href = '/auth';
    }
  };

  // PRODUCTION FIX: Enhanced loading and error states
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">Please sign in to view your profile</p>
            <Button onClick={() => window.location.href = '/auth'}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !customerAccount) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <p className="text-destructive mb-4">Authentication Error</p>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={refetch} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/auth'} className="w-full">
                Sign In Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ProductionMonitoring>
      <ProductionErrorBoundary>
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <User className="h-5 w-5 mr-2" />
                    My Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Valued customer
                    </p>
                  </div>
                  
                  <div className="pt-4 space-y-2">
                    <Button variant="ghost" className="w-full justify-start">
                      <Package className="h-4 w-4 mr-2" />
                      My Orders
                    </Button>
                    <Button variant="ghost" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-red-600 hover:text-red-700"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Main content */}
            <div className="lg:col-span-3">
              <OrdersSection />
            </div>
          </div>
        </div>
      </ProductionErrorBoundary>
    </ProductionMonitoring>
  );
};

export default CustomerProfileProduction;