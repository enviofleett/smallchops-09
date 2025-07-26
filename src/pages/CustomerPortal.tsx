import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Package, Star, TrendingUp, User, LogOut, Loader2 } from 'lucide-react';
import { DeliveryTracker } from '@/components/delivery/DeliveryTracker';
import { LoyaltyDashboard } from '@/components/loyalty/LoyaltyDashboard';
import { FavoritesSection } from '@/components/customers/FavoritesSection';
import { ProductCatalog } from '@/components/products/ProductCatalog';
import { CustomerAuthModal } from '@/components/auth/CustomerAuthModal';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useToast } from '@/hooks/use-toast';

export default function CustomerPortal() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, customerAccount, isLoading, isAuthenticated, logout } = useCustomerAuth();
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

  const mockOrderHistory = [
    {
      id: 'ord-1',
      orderNumber: 'ORD000001',
      date: '2024-01-20',
      status: 'delivered',
      total: 45.99,
      items: ['Chicken Burger', 'French Fries', 'Coke']
    },
    {
      id: 'ord-2',
      orderNumber: 'ORD000002',
      date: '2024-01-18',
      status: 'delivered',
      total: 32.50,
      items: ['Pizza Margherita', 'Garlic Bread']
    },
    {
      id: 'ord-3',
      orderNumber: 'ORD000003',
      date: '2024-01-15',
      status: 'cancelled',
      total: 28.99,
      items: ['Pasta Carbonara', 'Caesar Salad']
    }
  ];

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
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <User className="h-5 w-5" />
              Customer Portal
            </CardTitle>
            <CardDescription>
              Sign in to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => setShowAuthModal(true)} className="w-full">
              Sign In / Sign Up
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Create an account or sign in to manage your orders and favorites
            </div>
          </CardContent>
        </Card>

        <CustomerAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={handleAuthenticated}
        />
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="menu">Browse Menu</TabsTrigger>
            <TabsTrigger value="orders">Order History</TabsTrigger>
            <TabsTrigger value="favorites">My Favorites</TabsTrigger>
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
                  <div className="text-2xl font-bold">{mockOrderHistory.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {mockOrderHistory.filter(o => o.status === 'delivered').length} completed
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
                    ${mockOrderHistory.reduce((sum, order) => 
                      order.status === 'delivered' ? sum + order.total : sum, 0
                    ).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lifetime spending
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

            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Your latest order activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockOrderHistory.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">#{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">{order.date}</p>
                        </div>
                        <div>
                          <p className="text-sm">{order.items.join(', ')}</p>
                          <p className="text-sm font-medium">${order.total}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>All your past orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockOrderHistory.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">#{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">{order.date}</p>
                        </div>
                        <div>
                          <p className="text-sm">{order.items.join(', ')}</p>
                          <p className="text-sm font-medium">${order.total}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status.toUpperCase()}
                        </Badge>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu" className="space-y-6">
            <ProductCatalog />
          </TabsContent>

          <TabsContent value="favorites" className="space-y-6">
            <FavoritesSection customerId={customerAccount?.id || null} />
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