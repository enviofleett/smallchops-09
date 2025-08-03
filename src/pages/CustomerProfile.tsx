import React, { useState } from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerFavorites } from '@/hooks/useCustomerFavorites';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingBag, 
  Heart, 
  CreditCard, 
  MapPin, 
  HelpCircle, 
  LogOut,
  User,
  MoreHorizontal,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { PersonalInfoEditor } from '@/components/customer/PersonalInfoEditor';
import { AddressManager } from '@/components/customer/AddressManager';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

type ProfileSection = 'orders' | 'wishlist' | 'payment' | 'address' | 'help' | 'personal';

export default function CustomerProfile() {
  const { isAuthenticated, customerAccount, isLoading: authLoading, logout } = useCustomerAuth();
  const { favorites, isLoading: favoritesLoading } = useCustomerFavorites(customerAccount?.id || '');
  const { data: ordersData, isLoading: ordersLoading } = useCustomerOrders();
  const { data: settings } = useBusinessSettings();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ProfileSection>('orders');

  if (authLoading) {
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
                  onClick={() => setActiveSection(item.id as ProfileSection)}
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
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>
              ))}
              
              <div className="pt-4 border-t border-gray-200 mt-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors hover:bg-gray-50 text-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Login</span>
                  </div>
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// Orders Section Component
function OrdersSection({ orders, isLoading }: { orders: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-6">
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-1/3" />
              <div className="h-4 bg-gray-200 animate-pulse rounded w-2/3" />
              <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
        <p className="text-gray-500 mb-4">You haven't placed any orders yet</p>
        <Button onClick={() => window.location.href = '/products'}>
          Start Shopping
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Orders List */}
      <div className="flex-1 space-y-4">
        {orders.slice(0, 3).map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>

      {/* Order History Sidebar */}
      <div className="w-80 bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Order History</h3>
          <Button variant="ghost" size="sm" className="text-orange-600">
            View All
          </Button>
        </div>
        
        <div className="space-y-3">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm">Order {order.order_number}</p>
                <p className="text-xs text-gray-500">{new Date(order.order_time).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-sm">₦{order.total_amount.toLocaleString()}</p>
                <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="text-xs">
                  {order.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Order Card Component
function OrderCard({ order }: { order: any }) {
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

  // Sample data for display - replace with actual order data
  const displayName = `Order${order.order_number.slice(-1)}`;
  const originalPrice = order.total_amount * 1.2; // Simulate original price
  const discount = originalPrice - order.total_amount;

  return (
    <Card className="p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold mb-1">{displayName}</h3>
          <p className="text-sm text-gray-500">Order #{order.order_number}</p>
        </div>
        <Badge className={`px-2 py-1 text-xs ${getStatusColor(order.status)}`}>
          {order.status.replace('_', ' ').toUpperCase()}
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
            QTY: {order.order_items?.length || 1} • {order.order_items?.map((item: any) => item.product_name || 'Product').join(', ') || 'Items'}
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
              <span>₦{order.total_amount.toLocaleString()}</span>
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
              style={{ width: getProgressWidth(order.status) }}
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
}

// Wishlist Section Component
function WishlistSection({ favorites, isLoading }: { favorites: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading your wishlist...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My Wishlist</h2>
        <p className="text-gray-500">Your favorite items saved for later</p>
      </div>

      {favorites.length === 0 ? (
        <Card className="p-8 text-center">
          <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
          <p className="text-gray-500 mb-4">Save items you love to your wishlist</p>
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
              <p className="text-gray-500 text-sm mb-2">{product.description}</p>
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
        <p className="text-gray-500">Manage your saved payment methods</p>
      </div>

      <div className="space-y-4">
        {mockPaymentMethods.map((method) => (
          <Card key={method.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-gray-400" />
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
          <Button variant="ghost" className="w-full h-16 text-gray-500">
            + Add New Payment Method
          </Button>
        </Card>
      </div>
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
              <span className="text-orange-600 font-semibold">📞</span>
            </div>
            <div>
              <p className="font-medium">Phone Support</p>
              <p className="text-sm text-gray-500">+234 807 3011 100</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 font-semibold">✉️</span>
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