import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TrendingUp, ShoppingBag, Heart, Calendar, Star, Gift } from 'lucide-react';
import { useCustomerAnalytics } from '@/hooks/useCustomerProfile';
import { useCustomerFavorites } from '@/hooks/useCustomerFavorites';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { format } from 'date-fns';

export function ProfileAnalytics() {
  const { analytics, isLoading } = useCustomerAnalytics();
  const { customerAccount } = useCustomerAuth();
  const { favorites } = useCustomerFavorites(customerAccount?.id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Your Shopping Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {analytics?.totalOrders || 0}
              </div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics?.totalSpent || 0)}
              </div>
              <p className="text-sm text-muted-foreground">Total Spent</p>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Average Order Value</span>
              <span className="text-sm font-medium">
                {formatCurrency(analytics?.averageOrderValue || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Member Since</span>
              <span className="text-sm font-medium">
                {analytics?.memberSince 
                  ? format(new Date(analytics.memberSince), 'MMM yyyy')
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Favorite Items</span>
              <span className="text-sm font-medium">{favorites.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Favorite Categories */}
      {analytics?.favoriteCategories && analytics.favoriteCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5" />
              Favorite Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.favoriteCategories.slice(0, 3).map((category, index) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">{category.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {category.count} item{category.count !== 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {analytics?.recentOrders && analytics.recentOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recentOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      Order #{order.order_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(order.order_time), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatCurrency(order.total_amount)}
                    </p>
                    <Badge
                      variant={order.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loyalty Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Loyalty Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Star className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {(analytics?.totalSpent || 0) > 50000 ? 'VIP Customer' : 
               (analytics?.totalSpent || 0) > 20000 ? 'Gold Member' : 
               (analytics?.totalSpent || 0) > 5000 ? 'Silver Member' : 'Bronze Member'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {(analytics?.totalSpent || 0) > 50000 ? 'Enjoy exclusive benefits and priority support' :
               (analytics?.totalSpent || 0) > 20000 ? 'Great rewards and special offers await' :
               (analytics?.totalSpent || 0) > 5000 ? 'You\'re on your way to gold status!' :
               'Keep shopping to unlock more benefits'}
            </p>
          </div>
          
          {analytics?.loyaltyPoints && (
            <div className="pt-2">
              <p className="text-2xl font-bold text-primary">
                {analytics.loyaltyPoints}
              </p>
              <p className="text-sm text-muted-foreground">Loyalty Points</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}