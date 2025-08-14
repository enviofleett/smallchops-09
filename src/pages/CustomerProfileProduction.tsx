import React from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import ProductionOrdersList from '@/components/customer/ProductionOrdersList';
import ProductionErrorBoundary from '@/components/ProductionErrorBoundary';
import ProductionMonitoring from '@/components/ProductionMonitoring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Package, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CustomerProfileProduction = () => {
  const { user, logout } = useCustomerAuth();
  
  const handleSignOut = async () => {
    try {
      await logout();
      window.location.href = '/auth';
    } catch (error) {
      console.error('Sign out error:', error);
      window.location.href = '/auth';
    }
  };

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
              <ProductionErrorBoundary>
                <ProductionOrdersList customerEmail={user.email} />
              </ProductionErrorBoundary>
            </div>
          </div>
        </div>
      </ProductionErrorBoundary>
    </ProductionMonitoring>
  );
};

export default CustomerProfileProduction;