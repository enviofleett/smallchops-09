import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Package, Star, TrendingUp, User, LogOut, Loader2, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DeliveryTracker } from '@/components/delivery/DeliveryTracker';

import { FavoritesSection } from '@/components/customers/FavoritesSection';
import { ProductCatalog } from '@/components/products/ProductCatalog';
import { CustomerReviewsTab } from '@/components/customer/CustomerReviewsTab';
import { PaymentDebugger } from '@/components/admin/PaymentDebugger';

import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useToast } from '@/hooks/use-toast';
import { getCustomerOrderHistory } from '@/api/purchaseHistory';
import { OrderWithItems } from '@/api/orders';
import { UpcomingDeliveries } from '@/components/customer/UpcomingDeliveries';

export default function CustomerPortal() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [recentOrders, setRecentOrders] = useState<OrderWithItems[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const { user, customerAccount, isLoading, isAuthenticated, error: authError, refetch, logout } = useCustomerAuth();
  const { toast } = useToast();

  const handleAuthenticated = (customerId: string) => {
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message || "An error occurred during logout.",
        variant: "destructive",
      });
    }
  };

  // Load recent orders when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.email) {
      const fetchRecentOrders = async () => {
        try {
          setLoadingOrders(true);
          const { orders } = await getCustomerOrderHistory(user.email, { 
            pageSize: 3,
            status: 'all'
          });
          setRecentOrders(orders);
        } catch (error) {
          console.error('Error fetching recent orders:', error);
        } finally {
          setLoadingOrders(false);
        }
      };

      fetchRecentOrders();
    }
  }, [isAuthenticated, user?.email]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <div>
            <h3 className="text-lg font-medium">Setting up your account...</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {user ? 'Preparing your customer profile' : 'Checking authentication status'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle case where user is signed in but customer account creation failed
  if (user && !customerAccount && authError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Account Setup Issue</CardTitle>
            <CardDescription>
              There was an issue setting up your customer account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {authError}
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => refetch()}>
                Try Again
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Sign Out and Try Different Account
              </Button>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              If this problem persists, please contact support.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For unauthenticated users, show public catalog only
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Browse Our Menu</h1>
                <p className="text-muted-foreground">Discover our delicious offerings</p>
              </div>
              <div className="flex items-center gap-3">
                <Button asChild variant="outline">
                  <Link to="/auth?view=register">Create Account</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {/* Show only the public product catalog */}
          <ProductCatalog />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Welcome Back!</h1>
              <p className="text-muted-foreground">{customerAccount?.name || user?.email}</p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="menu">Browse Menu</TabsTrigger>
            <TabsTrigger value="orders">Order History</TabsTrigger>
            <TabsTrigger value="favorites">My Favorites</TabsTrigger>
            <TabsTrigger value="reviews">My Reviews</TabsTrigger>
            <TabsTrigger value="tracking">Track Order</TabsTrigger>
            <TabsTrigger value="loyalty">Loyalty & Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{recentOrders.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {recentOrders.filter(o => o.status === 'delivered').length} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${recentOrders.reduce((sum, order) => 
                      order.status === 'delivered' ? sum + Number(order.total_amount) : sum, 0
                    ).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recent orders total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Loyalty Points</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,250</div>
                  <p className="text-xs text-muted-foreground">
                    Silver tier member
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Payment Debug Section (Temporary) */}
            <div className="mb-6">
              <PaymentDebugger />
            </div>

            {/* Upcoming Deliveries Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <UpcomingDeliveries />
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>Your latest order activity</CardDescription>
                </CardHeader>
              <CardContent>
                {loadingOrders ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Loading orders...</p>
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentOrders.slice(0, 3).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">#{order.order_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.order_time).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm">
                              {order.order_items?.map(item => item.product_name).join(', ') || 'No items'}
                            </p>
                            <p className="text-sm font-medium">${order.total_amount}</p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                    {user?.email && (
                      <div className="text-center pt-4">
                        <Button asChild variant="outline">
                          <Link to={`/purchase-history/${encodeURIComponent(user.email)}`}>
                            View Full Purchase History
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
               </CardContent>
               </Card>
             </div>
           </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>All your past orders</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingOrders ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Loading orders...</p>
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No orders yet</p>
                    <Button asChild className="mt-4">
                      <Link to="#menu">Browse Menu</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">#{order.order_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.order_time).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm">
                              {order.order_items?.map(item => item.product_name).join(', ') || 'No items'}
                            </p>
                            <p className="text-sm font-medium">${order.total_amount}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {user?.email && (
                      <div className="text-center pt-4">
                        <Button asChild variant="outline">
                          <Link to={`/purchase-history/${encodeURIComponent(user.email)}`}>
                            View Full Purchase History
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu" className="space-y-6">
            <ProductCatalog />
          </TabsContent>

          <TabsContent value="favorites" className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">My Favorites</h2>
                <p className="text-muted-foreground">Your saved products</p>
              </div>
              <Button asChild>
                <Link to="/favorites" className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  View Full Favorites Page
                </Link>
              </Button>
            </div>
            <FavoritesSection customerId={customerAccount?.id || null} />
          </TabsContent>

          <TabsContent value="reviews" className="space-y-6">
            <CustomerReviewsTab />
          </TabsContent>

          <TabsContent value="tracking">
            <DeliveryTracker />
          </TabsContent>

          <TabsContent value="loyalty">
            <LoyaltyDashboard customerEmail={user?.email || ''} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}