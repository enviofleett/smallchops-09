import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Mail, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { useCartAbandonmentTracking } from '@/hooks/useCartAbandonmentTracking';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AbandonedCart {
  id: string;
  customer_email: string;
  total_value: number;
  cart_data: any;
  abandoned_at: string;
  recovery_email_sent_at: string | null;
  recovered_at: string | null;
}

export const CartAbandonmentDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { getCartRecoveryStats } = useCartAbandonmentTracking();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get stats
      const statsData = await getCartRecoveryStats(30);
      setStats(statsData);

      // Get abandoned carts
      const { data: carts, error } = await supabase
        .from('cart_abandonment_tracking')
        .select('*')
        .eq('is_abandoned', true)
        .is('recovered_at', null)
        .order('abandoned_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to fetch abandoned carts:', error);
      } else {
        setAbandonedCarts(carts || []);
      }
    } catch (error) {
      console.error('Error fetching cart abandonment data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch cart abandonment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerAbandonmentProcessor = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('cart-abandonment-processor');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Cart abandonment processor triggered successfully",
      });

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error triggering abandonment processor:', error);
      toast({
        title: "Error",
        description: "Failed to trigger cart abandonment processor",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cart Abandonment Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cart Abandonment Dashboard</h2>
          <p className="text-muted-foreground">Monitor and recover abandoned carts</p>
        </div>
        <Button 
          onClick={triggerAbandonmentProcessor}
          disabled={processing}
          variant="outline"
        >
          {processing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
          Process Abandonment
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Carts</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_carts || 0}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abandoned Carts</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.abandoned_carts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.abandoned_value || 0)} lost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.recovery_rate ? `${stats.recovery_rate.toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.recovered_carts || 0} recovered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cart Value</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.average_cart_value || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Average value</p>
          </CardContent>
        </Card>
      </div>

      {/* Abandoned Carts List */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">Recent Abandons</TabsTrigger>
          <TabsTrigger value="high-value">High Value</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recently Abandoned Carts</CardTitle>
              <CardDescription>
                Carts abandoned in the last few days that haven't been recovered
              </CardDescription>
            </CardHeader>
            <CardContent>
              {abandonedCarts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No abandoned carts found
                </p>
              ) : (
                <div className="space-y-4">
                  {abandonedCarts.map((cart) => (
                    <div key={cart.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">{cart.customer_email}</p>
                        <p className="text-sm text-muted-foreground">
                          {cart.cart_data?.length || 0} items • {formatCurrency(cart.total_value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Abandoned: {new Date(cart.abandoned_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {cart.recovery_email_sent_at ? (
                          <Badge variant="secondary">Email Sent</Badge>
                        ) : (
                          <Badge variant="destructive">No Email</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="high-value" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High Value Abandoned Carts</CardTitle>
              <CardDescription>
                Focus on recovering carts with highest potential value
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {abandonedCarts
                  .filter(cart => cart.total_value > 5000)
                  .sort((a, b) => b.total_value - a.total_value)
                  .map((cart) => (
                    <div key={cart.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/10">
                      <div className="space-y-1">
                        <p className="font-medium">{cart.customer_email}</p>
                        <p className="text-sm font-semibold text-yellow-600">
                          {formatCurrency(cart.total_value)} • {cart.cart_data?.length || 0} items
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Abandoned: {new Date(cart.abandoned_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                          High Value
                        </Badge>
                        {cart.recovery_email_sent_at ? (
                          <Badge variant="secondary">Email Sent</Badge>
                        ) : (
                          <Badge variant="destructive">Action Needed</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                {abandonedCarts.filter(cart => cart.total_value > 5000).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No high value abandoned carts found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};