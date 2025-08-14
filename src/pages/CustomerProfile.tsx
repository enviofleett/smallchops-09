import React, { useState, useMemo, Suspense } from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerFavorites } from '@/hooks/useCustomerFavorites';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Navigate, useNavigate } from 'react-router-dom';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { AddressManager } from '@/components/customer/AddressManager';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { EnhancedOrdersSection } from '@/components/customer/EnhancedOrdersSection';
import { EnhancedWishlistSection } from '@/components/customer/EnhancedWishlistSection';
import { TransactionHistoryTab } from '@/components/purchase-history/TransactionHistoryTab';
import { CustomerBookingsSection } from '@/components/customer/CustomerBookingsSection';

type ProfileSection = 'orders' | 'tracking' | 'wishlist' | 'payment' | 'address' | 'help' | 'bookings';

// Loading skeleton component
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

export default function CustomerProfile() {
  const { isAuthenticated, customerAccount, isLoading: authLoading, logout, error: authError } = useCustomerAuth();
  const { data: settings } = useBusinessSettings();
  const { handleError } = useErrorHandler();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ProfileSection>('orders');

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-80">
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
            <div className="flex-1">
              <ContentSkeleton />
            </div>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (!isAuthenticated && !authLoading) {
    return <Navigate to="/auth" replace />;
  }

  // Show error state if authentication failed
  if (authError && !authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6">
          <Card className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{authError}</p>
            <Button onClick={() => navigate('/auth')}>
              Return to Login
            </Button>
          </Card>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'orders':
        return <EnhancedOrdersSection />;
      case 'tracking':
        // This will be handled by navigation, fallback to orders
        return <EnhancedOrdersSection />;
      case 'bookings':
        return <CustomerBookingsSection />;
      case 'wishlist':
        return <EnhancedWishlistSection />;
      case 'payment':
        return <PaymentSection />;
      case 'address':
        return <AddressManager />;
      case 'help':
        return <HelpSection settings={settings} />;
      default:
        return <EnhancedOrdersSection />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-80 bg-white rounded-lg shadow-sm border border-border p-6">
            <h1 className="text-xl font-bold mb-6">Account</h1>
            
            {/* Navigation */}
            <nav className="space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.path) {
                      navigate(item.path);
                    } else {
                      setActiveSection(item.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.path ? (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  ) : (
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))}
              
              <div className="pt-4 border-t border-gray-200 mt-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors hover:bg-gray-50 text-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <ErrorBoundary fallback={<SectionErrorFallback section={activeSection} />}>
              {renderContent()}
            </ErrorBoundary>
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

  // Safe data extraction with defaults
  const orderNumber = order?.order_number || 'N/A';
  const displayName = `Order${orderNumber !== 'N/A' ? orderNumber.slice(-1) : ''}`;
  const totalAmount = typeof order?.total_amount === 'number' ? order.total_amount : 0;
  const originalPrice = totalAmount * 1.2; // Simulate original price
  const discount = originalPrice - totalAmount;
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

  return <TransactionHistoryTab customerEmail={customerEmail} />;
}