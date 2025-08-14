import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

// Simple Error Boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Customer Profile Error:', error, errorInfo);
    
    // Log to external service if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-600 mb-6">Ouch please refresh your page to continue</p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
              >
                Refresh Page
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simple Loading Component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
  </div>
);

// Simple Card Component
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
    {children}
  </div>
);

// Simple Button Component
const Button = ({ 
  children, 
  onClick, 
  className = "", 
  variant = "primary" 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  className?: string;
  variant?: "primary" | "secondary" | "outline";
}) => {
  const baseClasses = "px-4 py-2 rounded-lg font-medium transition-colors";
  const variantClasses = {
    primary: "bg-orange-600 text-white hover:bg-orange-700",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50"
  };

  return (
    <button 
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// Simplified Badge Component
const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);

// Simple Icons (SVG components)
const Icons = {
  ShoppingBag: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  Heart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  CreditCard: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  MapPin: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    </svg>
  ),
  HelpCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  LogOut: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Package: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  Phone: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  Mail: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
};

// Simplified Customer Auth Hook
function useCustomerAuth() {
  const [state, setState] = useState({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    // Simulate auth check
    setTimeout(() => {
      try {
        const user = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        
        if (user && token) {
          setState({
            isAuthenticated: true,
            user: JSON.parse(user),
            isLoading: false,
            error: null
          });
        } else {
          setState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            error: null
          });
        }
      } catch (error) {
        setState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: 'Authentication failed'
        });
      }
    }, 1000);
  }, []);

  const logout = async () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    });
  };

  return { ...state, logout };
}

// Simple Header Component
const SimpleHeader = () => (
  <header className="bg-white shadow-sm border-b border-gray-200">
    <div className="container mx-auto px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold text-orange-600">
          Starters Small Chops
        </div>
        <nav className="hidden md:flex space-x-6">
          <a href="/" className="text-gray-600 hover:text-gray-900">Home</a>
          <a href="/menu" className="text-gray-600 hover:text-gray-900">Menu</a>
          <a href="/about" className="text-gray-600 hover:text-gray-900">About</a>
          <a href="/contact" className="text-gray-600 hover:text-gray-900">Contact</a>
        </nav>
      </div>
    </div>
  </header>
);

// Simple Footer Component
const SimpleFooter = () => (
  <footer className="bg-gray-900 text-white py-8">
    <div className="container mx-auto px-4">
      <div className="text-center">
        <p className="text-gray-400">© 2024 Starters Small Chops. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

// Main Customer Profile Component
export default function CustomerProfile() {
  const { isAuthenticated, user, isLoading, logout, error } = useCustomerAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('orders');

  // Debug logging
  useEffect(() => {
    console.log('CustomerProfile mounted:', { isAuthenticated, user, isLoading, error });
  }, [isAuthenticated, user, isLoading, error]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SimpleHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-96">
            <LoadingSpinner />
          </div>
        </div>
        <SimpleFooter />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/auth" replace />;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SimpleHeader />
        <div className="container mx-auto px-4 py-8">
          <Card className="p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/auth')}>
              Return to Login
            </Button>
          </Card>
        </div>
        <SimpleFooter />
      </div>
    );
  }

  const sidebarItems = [
    { id: 'orders', label: 'My Orders', icon: Icons.ShoppingBag, path: '/purchase-history' },
    { id: 'tracking', label: 'Order Summary', icon: Icons.Package, path: '/order-summary' },
    { id: 'bookings', label: 'Catering Bookings', icon: Icons.Calendar },
    { id: 'wishlist', label: 'Wishlist', icon: Icons.Heart, path: '/customer-favorites' },
    { id: 'payment', label: 'Payment Method', icon: Icons.CreditCard },
    { id: 'address', label: 'Delivery Address', icon: Icons.MapPin },
    { id: 'help', label: 'Help', icon: Icons.HelpCircle },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'orders':
        return <OrdersSection />;
      case 'tracking':
        return <TrackingSection />;
      case 'bookings':
        return <BookingsSection />;
      case 'wishlist':
        return <WishlistSection />;
      case 'payment':
        return <PaymentSection />;
      case 'address':
        return <AddressSection />;
      case 'help':
        return <HelpSection />;
      default:
        return <OrdersSection />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <SimpleHeader />
        
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar */}
            <div className="lg:w-80">
              <Card className="p-6">
                <h1 className="text-xl font-bold mb-6">Account</h1>
                
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
                        <item.icon />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <Icons.ChevronRight />
                    </button>
                  ))}
                  
                  <div className="pt-4 border-t border-gray-200 mt-4">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors hover:bg-gray-50 text-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <Icons.LogOut />
                        <span className="font-medium">Logout</span>
                      </div>
                    </button>
                  </div>
                </nav>
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              <ErrorBoundary fallback={<div className="text-center p-8">Content temporarily unavailable</div>}>
                {renderContent()}
              </ErrorBoundary>
            </div>
          </div>
        </div>

        <SimpleFooter />
      </div>
    </ErrorBoundary>
  );
}

// Section Components
function OrdersSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My Orders</h2>
        <p className="text-gray-500">Track and manage your orders</p>
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold mb-1">Order #{i}001</h3>
                <p className="text-sm text-gray-500">Placed on Dec {i + 10}, 2024</p>
              </div>
              <Badge className="bg-green-100 text-green-800">
                Delivered
              </Badge>
            </div>
            
            <div className="flex gap-4 mb-4">
              <div className="w-16 h-16 bg-gray-100 rounded-lg"></div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1">Small Chops Combo</h4>
                <p className="text-sm text-gray-500 mb-2">QTY: 2 • Small Chops, Spring Rolls</p>
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>₦{(15000 + i * 2000).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <Button variant="outline">View Details</Button>
              <Button variant="secondary">Reorder</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TrackingSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Order Tracking</h2>
        <p className="text-gray-500">Track your current orders</p>
      </div>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">No active orders</h3>
        <p className="text-gray-500 mb-4">You don't have any orders in progress right now.</p>
        <Button onClick={() => window.location.href = '/menu'}>
          Browse Menu
        </Button>
      </Card>
    </div>
  );
}

function BookingsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Catering Bookings</h2>
        <p className="text-gray-500">Manage your catering reservations</p>
      </div>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">No bookings yet</h3>
        <p className="text-gray-500 mb-4">Book catering services for your events.</p>
        <Button onClick={() => window.location.href = '/catering'}>
          Book Catering
        </Button>
      </Card>
    </div>
  );
}

function WishlistSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My Wishlist</h2>
        <p className="text-gray-500">Items you want to order later</p>
      </div>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Your wishlist is empty</h3>
        <p className="text-gray-500 mb-4">Add items to your wishlist while browsing our menu.</p>
        <Button onClick={() => window.location.href = '/menu'}>
          Browse Menu
        </Button>
      </Card>
    </div>
  );
}

function PaymentSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Payment Methods</h2>
        <p className="text-gray-500">Manage your payment options</p>
      </div>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">No saved payment methods</h3>
        <p className="text-gray-500 mb-4">Add payment methods for faster checkout.</p>
        <Button>Add Payment Method</Button>
      </Card>
    </div>
  );
}

function AddressSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Delivery Addresses</h2>
        <p className="text-gray-500">Manage your delivery locations</p>
      </div>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">No saved addresses</h3>
        <p className="text-gray-500 mb-4">Add delivery addresses for faster ordering.</p>
        <Button>Add Address</Button>
      </Card>
    </div>
  );
}

function HelpSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Help & Support</h2>
        <p className="text-gray-500">Get help with your orders and account</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Icons.Phone />
            </div>
            <div>
              <p className="font-medium">Phone Support</p>
              <p className="text-sm text-gray-500">+234 807 3011 100</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Icons.Mail />
            </div>
            <div>
              <p className="font-medium">Email Support</p>
              <p className="text-sm text-gray-500">support@starters.co</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Frequently Asked Questions</h3>
        <div className="space-y-3">
          <details className="group">
            <summary className="flex justify-between items-center cursor-pointer">
              <span>How do I track my order?</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <p className="mt-2 text-gray-600">You can track your order in the "Order Tracking" section of your account.</p>
          </details>
          <details className="group">
            <summary className="flex justify-between items-center cursor-pointer">
              <span>What is your refund policy?</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <p className="mt-2 text-gray-600">We offer refunds within 24 hours of order placement if the order hasn't been prepared.</p>
          </details>
          <details className="group">
            <summary className="flex justify-between items-center cursor-pointer">
              <span>How do I cancel an order?</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <p className="mt-2 text-gray-600">Orders can be cancelled within 10 minutes of placement. Contact support for assistance.</p>
          </details>
        </div>
      </Card>
    </div>
  );
}
