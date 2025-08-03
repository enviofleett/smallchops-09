import React, { useState } from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerFavorites } from '@/hooks/useCustomerFavorites';
import { useOrderManagement } from '@/hooks/useOrderManagement';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingBag, 
  Heart, 
  CreditCard, 
  MapPin, 
  HelpCircle, 
  LogOut,
  Truck,
  Clock,
  CheckCircle2,
  Package,
  ArrowLeft,
  User,
  Phone,
  Mail
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { PersonalInfoEditor } from '@/components/customer/PersonalInfoEditor';
import { AddressManager } from '@/components/customer/AddressManager';
import { useCustomerProfile, useProfileCompletion } from '@/hooks/useCustomerProfile';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

type ProfileSection = 'orders' | 'wishlist' | 'payment' | 'address' | 'help' | 'personal';

export default function CustomerProfile() {
  const { isAuthenticated, customerAccount, isLoading: authLoading, logout } = useCustomerAuth();
  const { profile, isLoading: profileLoading } = useCustomerProfile();
  const { data: completionPercentage = 0 } = useProfileCompletion();
  const { favorites, isLoading: favoritesLoading } = useCustomerFavorites(customerAccount?.id || '');
  const { data: ordersData, isLoading: ordersLoading } = useCustomerOrders();
  const { data: settings } = useBusinessSettings();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ProfileSection>('orders');

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const sidebarItems = [
    { id: 'orders', label: 'My Order', icon: ShoppingBag },
    { id: 'wishlist', label: 'Wishlist', icon: Heart },
    { id: 'payment', label: 'Payment Method', icon: CreditCard },
    { id: 'address', label: 'Delivery Address', icon: MapPin },
    { id: 'help', label: 'Help', icon: HelpCircle },
    { id: 'personal', label: 'Personal Info', icon: User },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'orders':
        return <OrdersSection orders={ordersData?.orders || []} isLoading={ordersLoading} />;
      case 'wishlist':
        return <WishlistSection favorites={favorites} isLoading={favoritesLoading} />;
      case 'payment':
        return <PaymentSection />;
      case 'address':
        return <AddressManager />;
      case 'help':
        return <HelpSection settings={settings} />;
      case 'personal':
        return <PersonalInfoEditor />;
      default:
        return <OrdersSection orders={ordersData?.orders || []} isLoading={ordersLoading} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback>
                {customerAccount?.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block">
              <h2 className="font-semibold">{customerAccount?.name || 'Customer'}</h2>
              <p className="text-sm text-muted-foreground">Profile: {completionPercentage}% complete</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-72 bg-background border-r border-border md:min-h-screen">
          <div className="p-4 md:p-6">
            <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">My Profile</h1>
            
            {/* Profile Completion */}
            <Card className="mb-4 md:mb-6">
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Profile Completion</span>
                    <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
                  </div>
                  <Progress value={completionPercentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Complete your profile to get better recommendations
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <nav className="space-y-2 md:block grid grid-cols-2 gap-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as ProfileSection)}
                  className={`w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-medium text-sm md:text-base">{item.label}</span>
                </button>
              ))}
              
              <Separator className="my-4" />
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors hover:bg-destructive/10 text-destructive hover:text-destructive"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6">
          <ScrollArea className="h-[calc(100vh-120px)]">
            {renderContent()}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// Orders Section Component
function OrdersSection({ orders, isLoading }: { orders: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading your orders...</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'preparing':
        return <Package className="w-5 h-5 text-orange-500" />;
      case 'out_for_delivery':
        return <Truck className="w-5 h-5 text-blue-500" />;
      case 'delivered':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'preparing':
        return 'Preparing';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'delivered':
        return 'Delivered';
      default:
        return 'Processing';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My Orders</h2>
        <p className="text-muted-foreground">Track your recent and past orders</p>
      </div>

      {orders.length === 0 ? (
        <Card className="p-8 text-center">
          <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
          <p className="text-muted-foreground mb-4">You haven't placed any orders yet</p>
          <Button onClick={() => window.location.href = '/products'}>
            Start Shopping
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 gap-3">
                <div>
                  <h3 className="font-semibold text-base md:text-lg">Order {order.order_number}</h3>
                  <p className="text-sm text-muted-foreground">{new Date(order.order_time).toLocaleDateString()}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-semibold">₦{order.total_amount.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(order.status)}
                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                      {getStatusText(order.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Items ({order.order_items?.length || 0}):</p>
                <p className="text-sm">
                  {order.order_items?.map((item: any) => item.product_name || 'Product').join(', ') || 'Order items'}
                </p>
              </div>

              {order.status === 'out_for_delivery' && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Estimated arrival: 15-20 min
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full w-3/4"></div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" size="sm">
                  View Details
                </Button>
                {order.status === 'delivered' && (
                  <Button variant="outline" size="sm">
                    Reorder
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Wishlist Section Component
function WishlistSection({ favorites, isLoading }: { favorites: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading your wishlist...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My Wishlist</h2>
        <p className="text-muted-foreground">Your favorite items saved for later</p>
      </div>

      {favorites.length === 0 ? (
        <Card className="p-8 text-center">
          <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
          <p className="text-muted-foreground mb-4">Save items you love to your wishlist</p>
          <Button onClick={() => window.location.href = '/products'}>
            Browse Products
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((product) => (
            <Card key={product.id} className="p-4">
              <img
                src={product.image_url || '/placeholder.svg'}
                alt={product.name}
                className="w-full h-32 object-cover rounded-lg mb-3"
              />
              <h3 className="font-semibold mb-1">{product.name}</h3>
              <p className="text-muted-foreground text-sm mb-2">{product.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-bold">₦{product.price.toLocaleString()}</span>
                <Button size="sm">Add to Cart</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Payment Section Component
function PaymentSection() {
  const mockPaymentMethods = [
    { id: '1', type: 'card', last4: '4532', brand: 'Visa', isDefault: true },
    { id: '2', type: 'card', last4: '8901', brand: 'Mastercard', isDefault: false }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Payment Methods</h2>
        <p className="text-muted-foreground">Manage your saved payment methods</p>
      </div>

      <div className="space-y-4">
        {mockPaymentMethods.map((method) => (
          <Card key={method.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-muted-foreground" />
                <div>
                  <p className="font-medium">{method.brand} ending in {method.last4}</p>
                  {method.isDefault && (
                    <Badge variant="secondary" className="mt-1">Default</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Edit</Button>
                <Button variant="outline" size="sm">Remove</Button>
              </div>
            </div>
          </Card>
        ))}
        
        <Card className="p-4 border-dashed">
          <Button variant="ghost" className="w-full h-16 text-muted-foreground">
            + Add New Payment Method
          </Button>
        </Card>
      </div>
    </div>
  );
}

// Help Section Component
function HelpSection({ settings }: { settings: any }) {
  const helpTopics = [
    'How to place an order',
    'Payment and billing',
    'Delivery information',
    'Returns and refunds',
    'Account settings',
    'Promotions and discounts'
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Help & Support</h2>
        <p className="text-muted-foreground">Get help with your orders and account</p>
      </div>

      {/* Contact Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Phone Support</p>
              <p className="text-sm text-muted-foreground">+234 807 3011 100</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Email Support</p>
              <p className="text-sm text-muted-foreground">support@starters.co</p>
            </div>
          </div>
        </div>
      </Card>

      {/* FAQ */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Frequently Asked Questions</h3>
        <div className="space-y-2">
          {helpTopics.map((topic, index) => (
            <button
              key={index}
              className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <span className="text-sm">{topic}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}