import React, { useState, useMemo, Suspense, useCallback, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { 
  ShoppingBag, 
  Heart, 
  CreditCard, 
  MapPin, 
  HelpCircle, 
  LogOut,
  MoreHorizontal,
  Clock,
  ChevronRight,
  Phone,
  Mail,
  AlertTriangle,
  Calendar,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { ProductionSafeErrorBoundary } from '@/components/ProductionSafeErrorBoundary';
import { HydrationSafeRoot } from '@/components/HydrationSafeRoot';
import { AssetLoader } from '@/utils/assetLoader';

type ProfileSection = 'orders' | 'tracking' | 'wishlist' | 'payment' | 'address' | 'help' | 'bookings';

// Import simple fallback component directly
import SimpleOrdersSection from '@/components/customer/SimpleOrdersSection';

// Simplified lazy loading without error handling - let error boundaries handle
const LazyEnhancedOrdersSection = React.lazy(() => 
  import('@/components/customer/EnhancedOrdersSection')
    .then(m => ({ default: m.EnhancedOrdersSection }))
);

const LazyEnhancedWishlistSection = React.lazy(() => 
  import('@/components/customer/EnhancedWishlistSection')
    .then(m => ({ default: m.EnhancedWishlistSection }))
);

const LazyCustomerBookingsSection = React.lazy(() => 
  import('@/components/customer/CustomerBookingsSection')
    .then(m => ({ default: m.CustomerBookingsSection }))
);

const LazyAddressManager = React.lazy(() => 
  import('@/components/customer/AddressManager')
    .then(m => ({ default: m.AddressManager }))
);

const LazyTransactionHistoryTab = React.lazy(() => 
  import('@/components/purchase-history/TransactionHistoryTab')
    .then(m => ({ default: m.TransactionHistoryTab }))
);

// Hydration-safe component wrapper
function withHydration<P extends object>(Component: React.ComponentType<P>) {
  return function HydratedComponent(props: P) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
      AssetLoader.preloadCriticalAssets();
    }, []);

    if (!mounted) {
      // Return SSR-compatible loading state
      return (
        <div className="min-h-screen bg-background">
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

// Content skeleton for loading states - SSR-safe
const ContentSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    ))}
  </div>
);

const CustomerProfileComponent = () => {
  const { isAuthenticated, user, customerAccount, isLoading: authLoading, logout, error: authError } = useCustomerAuth();
  const { data: settings } = useBusinessSettings();
  const { handleError } = useErrorHandler();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ProfileSection>('orders');

  // SSR-safe effect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('CustomerProfile mounted on client:', {
        isAuthenticated,
        hasUser: !!user,
        hasCustomerAccount: !!customerAccount,
        authLoading,
        authError
      });
    }
  }, [isAuthenticated, user, customerAccount, authLoading, authError]);

  // Memoize sidebar items to prevent unnecessary re-renders
  const sidebarItems = useMemo(() => [
    { id: 'orders' as const, label: 'My Orders', icon: ShoppingBag, path: '/purchase-history' },
    { id: 'tracking' as const, label: 'Order Summary', icon: Package, path: '/order-summary' },
    { id: 'bookings' as const, label: 'Catering Bookings', icon: Calendar },
    { id: 'wishlist' as const, label: 'Wishlist', icon: Heart, path: '/customer-favorites' },
    { id: 'payment' as const, label: 'Payment Method', icon: CreditCard },
    { id: 'address' as const, label: 'Delivery Address', icon: MapPin },
    { id: 'help' as const, label: 'Help', icon: HelpCircle },
  ], []);

  const handleLogout = React.useCallback(async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      handleError(error, 'logout');
    }
  }, [logout, navigate, handleError]);

  // Loading state - must match SSR
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-center items-center min-h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated && !authLoading) {
    return <Navigate to="/auth" replace />;
  }

  // Error state
  if (authError) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-md mx-auto bg-card rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
            <p className="text-muted-foreground mb-4">{authError}</p>
            <Button onClick={() => navigate('/auth')}>
              Return to Login
            </Button>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const renderContent = useCallback(() => {
    switch (activeSection) {
      case 'orders':
        return (
          <ProductionSafeErrorBoundary context="Customer Orders" fallback={SimpleOrdersSection}>
            <LazyEnhancedOrdersSection />
          </ProductionSafeErrorBoundary>
        );
      case 'tracking':
        return (
          <ProductionSafeErrorBoundary context="Order Tracking" fallback={SimpleOrdersSection}>
            <LazyEnhancedOrdersSection />
          </ProductionSafeErrorBoundary>
        );
      case 'bookings':
        return (
          <ProductionSafeErrorBoundary context="Customer Bookings" fallback={() => <SectionErrorFallback section="bookings" />}>
            <LazyCustomerBookingsSection />
          </ProductionSafeErrorBoundary>
        );
      case 'wishlist':
        return (
          <ProductionSafeErrorBoundary context="Customer Wishlist" fallback={() => <SectionErrorFallback section="wishlist" />}>
            <LazyEnhancedWishlistSection />
          </ProductionSafeErrorBoundary>
        );
      case 'payment':
        return (
          <ProductionSafeErrorBoundary context="Payment History" fallback={() => <SectionErrorFallback section="payment" />}>
            <PaymentSection />
          </ProductionSafeErrorBoundary>
        );
      case 'address':
        return (
          <ProductionSafeErrorBoundary context="Address Management" fallback={() => <SectionErrorFallback section="address" />}>
            <LazyAddressManager />
          </ProductionSafeErrorBoundary>
        );
      case 'help':
        return (
          <ProductionSafeErrorBoundary context="Help Section" fallback={() => <SectionErrorFallback section="help" />}>
            <HelpSection settings={settings} />
          </ProductionSafeErrorBoundary>
        );
      default:
        return (
          <ProductionSafeErrorBoundary context="Default Orders View" fallback={SimpleOrdersSection}>
            <LazyEnhancedOrdersSection />
          </ProductionSafeErrorBoundary>
        );
    }
  }, [activeSection, settings, handleError]);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-80 bg-card rounded-lg shadow-sm border border-border p-6">
            <h1 className="text-xl font-bold mb-6">Account</h1>
            
            {/* Navigation */}
            <nav className="space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    try {
                      if (item.path) {
                        setActiveSection(item.id); // Keep activeSection in sync
                        navigate(item.path);
                      } else {
                        setActiveSection(item.id);
                      }
                    } catch (error) {
                      console.error('Navigation error:', error);
                      handleError(error, 'customer-profile-navigation');
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.path ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              ))}
              
              <div className="pt-4 border-t border-border mt-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors hover:bg-muted text-foreground"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <Suspense fallback={<ContentSkeleton />}>
              {renderContent()}
            </Suspense>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// Error fallback component for sections
function SectionErrorFallback({ section }: { section: string }) {
  return (
    <Card className="p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">Unable to load {section}</h3>
      <p className="text-gray-500 mb-4">Something went wrong while loading this section.</p>
      <Button onClick={() => window.location.reload()}>
        Refresh Page
      </Button>
    </Card>
  );
}


// Memoized Order Card component with comprehensive null safety
const OrderCard = React.memo(({ order }: { order: any }) => {
  // Validate order object
  if (!order || typeof order !== 'object') {
    return (
      <Card className="p-6 border border-red-200">
        <p className="text-red-600">Invalid order data</p>
      </Card>
    );
  }
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressWidth = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '25%';
      case 'preparing':
        return '50%';
      case 'out_for_delivery':
        return '75%';
      case 'delivered':
        return '100%';
      default:
        return '10%';
    }
  };

  // ✅ PHASE 3: Fixed business logic placeholders
  const orderNumber = order?.order_number || 'N/A';
  const displayName = orderNumber !== 'N/A' ? `Order #${orderNumber}` : 'Order';
  const totalAmount = typeof order?.total_amount === 'number' ? order.total_amount : 0;
  // Use real original price from order data, fallback to total if not available
  const originalPrice = typeof order?.original_amount === 'number' ? order.original_amount : totalAmount;
  const discount = originalPrice > totalAmount ? originalPrice - totalAmount : 0;
  const status = order?.status || 'unknown';
  const orderItems = Array.isArray(order?.order_items) ? order.order_items : [];

  return (
    <Card className="p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold mb-1">{displayName}</h3>
          <p className="text-sm text-gray-500">Order #{orderNumber}</p>
        </div>
        <Badge className={`px-2 py-1 text-xs ${getStatusColor(status)}`}>
          {status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      <div className="flex gap-4 mb-4">
        {/* Product Image Placeholder */}
        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="w-8 h-8 bg-gray-300 rounded"></div>
        </div>
        
        <div className="flex-1">
          <h4 className="font-semibold mb-1">The Budget Baller</h4>
          <p className="text-sm text-gray-500 mb-2">
            QTY: {orderItems.length || 1} • {orderItems.map((item: any) => item?.product_name || 'Product').join(', ') || 'Items'}
          </p>
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-sm">Original Price:</span>
              <span className="text-sm line-through text-gray-500">₦{originalPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Discount:</span>
              <span className="text-sm text-red-500">-₦{discount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total:</span>
              <span>₦{totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Tracking */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Expected by</span>
          <div className="flex items-center gap-1 text-orange-600">
            <Clock className="w-4 h-4" />
            <span>15-20 min</span>
          </div>
        </div>
        
          <div className="relative">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: getProgressWidth(status) }}
              ></div>
            </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Order Placed</span>
            <span>Preparing</span>
            <span>On the way</span>
            <span>Delivered</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
        <Button variant="outline" size="sm">
          View Details
        </Button>
        <Button variant="ghost" size="sm" className="text-orange-600">
          Track Order <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
});

OrderCard.displayName = 'OrderCard';


// Payment Section - simplified without payment details column
function PaymentSection() {
  const { customerAccount, user } = useCustomerAuth();
  const customerEmail = user?.email || customerAccount?.email || '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Transaction History</h2>
        <p className="text-gray-500">View your purchase and payment history</p>
      </div>

      <Suspense fallback={<ContentSkeleton />}>
        <TransactionHistorySection customerEmail={customerEmail} />
      </Suspense>
    </div>
  );
}

// Help Section Component
function HelpSection({ settings }: { settings: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Help & Support</h2>
        <p className="text-gray-500">Get help with your orders and account</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium">Phone Support</p>
              <p className="text-sm text-gray-500">+234 807 3011 100</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Mail className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium">Email Support</p>
              <p className="text-sm text-gray-500">support@starters.co</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Transaction History Section Component
function TransactionHistorySection({ customerEmail }: { customerEmail: string }) {
  if (!customerEmail) {
    return (
      <Card className="p-8 text-center">
        <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Transaction History</h3>
        <p className="text-gray-500">Please log in to view your transaction history</p>
      </Card>
    );
  }

  return (
    <Suspense fallback={<ContentSkeleton />}>
      <LazyTransactionHistoryTab customerEmail={customerEmail} />
    </Suspense>
  );
}

// Export wrapped component
export default withHydration(() => (
  <HydrationSafeRoot>
    <ProductionSafeErrorBoundary>
      <CustomerProfileComponent />
    </ProductionSafeErrorBoundary>
  </HydrationSafeRoot>
));
