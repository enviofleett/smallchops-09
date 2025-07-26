import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Search, Download, Package, CreditCard, TrendingUp, Receipt } from 'lucide-react';
import { OrderHistoryTab } from '@/components/purchase-history/OrderHistoryTab';
import { TransactionHistoryTab } from '@/components/purchase-history/TransactionHistoryTab';
import { PurchaseAnalyticsTab } from '@/components/purchase-history/PurchaseAnalyticsTab';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { getCustomerAnalytics, CustomerAnalytics } from '@/api/purchaseHistory';
import { useToast } from '@/hooks/use-toast';

export default function PurchaseHistory() {
  const { customerEmail } = useParams<{ customerEmail: string }>();
  const { user, isAuthenticated } = useCustomerAuth();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authorized to view this customer's data
  const isAuthorized = isAuthenticated && user?.email === customerEmail;

  useEffect(() => {
    if (!isAuthorized || !customerEmail) return;

    const fetchAnalytics = async () => {
      try {
        const data = await getCustomerAnalytics(customerEmail);
        setAnalytics(data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast({
          title: "Error",
          description: "Failed to load purchase analytics",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [customerEmail, isAuthorized, toast]);

  if (!isAuthenticated || !customerEmail) {
    return <Navigate to="/customer-portal" replace />;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              You can only view your own purchase history.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Purchase History</h1>
          <p className="text-muted-foreground">
            View your complete order history, transactions, and purchase analytics
          </p>
        </div>

        {/* Quick Stats */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{analytics.total_orders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Spent</p>
                    <p className="text-2xl font-bold">${analytics.total_spent}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Average Order</p>
                    <p className="text-2xl font-bold">${analytics.average_order_value.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Order</p>
                    <p className="text-sm font-medium">
                      {analytics.last_purchase_date 
                        ? new Date(analytics.last_purchase_date).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="orders" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Orders
                </TabsTrigger>
                <TabsTrigger value="transactions" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="orders" className="mt-6">
                <OrderHistoryTab customerEmail={customerEmail} />
              </TabsContent>

              <TabsContent value="transactions" className="mt-6">
                <TransactionHistoryTab customerEmail={customerEmail} />
              </TabsContent>

              <TabsContent value="analytics" className="mt-6">
                <PurchaseAnalyticsTab 
                  customerEmail={customerEmail} 
                  analytics={analytics} 
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}