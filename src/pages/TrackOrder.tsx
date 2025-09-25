import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';
import { DeliveryScheduleCard } from '@/components/orders/DeliveryScheduleCard';
import { getDeliveryScheduleByOrderId } from '@/api/deliveryScheduleApi';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  MapPin,
  Phone,
  User,
  Navigation
} from 'lucide-react';
import { format } from 'date-fns';

export default function TrackOrder() {
  const [orderIdentifier, setOrderIdentifier] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const { tracking, loading, error, trackOrder } = useDeliveryTracking();

  // Get delivery schedule if order is found
  const { data: deliverySchedule } = useQuery({
    queryKey: ['delivery-schedule', tracking?.orderId],
    queryFn: () => getDeliveryScheduleByOrderId(tracking!.orderId),
    enabled: !!tracking?.orderId,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      setOrderIdentifier(searchValue.trim());
      trackOrder(searchValue.trim());
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'out_for_delivery':
        return <Truck className="w-5 h-5 text-blue-600" />;
      case 'preparing':
        return <Package className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Helmet>
        <title>Track Your Order - Real-time Delivery Updates</title>
        <meta name="description" content="Track your order in real-time. Get live updates on your delivery status, estimated arrival time, and rider information." />
      </Helmet>

      <PublicHeader />
      
      <main className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Track Your Order</h1>
            <p className="text-muted-foreground">
              Enter your order number or order ID to get real-time delivery updates
            </p>
          </div>

          {/* Search Form */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Find Your Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-4">
                <Input
                  type="text"
                  placeholder="Enter order number (e.g., ORD-12345) or order ID"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || !searchValue.trim()}>
                  {loading ? 'Searching...' : 'Track Order'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Error State */}
          {error && (
            <Card className="mb-8 border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-center text-red-700">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">{error}</p>
                  <p className="text-sm mt-1">Please check your order number and try again</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Tracking Results */}
          {tracking && (
            <div className="space-y-6">
              {/* Order Status Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(tracking.status)}
                      Order #{tracking.orderNumber}
                    </CardTitle>
                    <Badge className={getStatusColor(tracking.status)}>
                      {tracking.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Order Info */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2">Order Information</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Order ID:</span>
                            <span className="font-mono">{tracking.orderId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span className="capitalize">{tracking.status.replace('_', ' ')}</span>
                          </div>
                          {tracking.estimatedDeliveryTime && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Est. Delivery:</span>
                              <span>{format(new Date(tracking.estimatedDeliveryTime), 'PPp')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rider Info */}
                    {tracking.riderInfo && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold mb-2">Delivery Rider</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span>{tracking.riderInfo.name}</span>
                            </div>
                            {tracking.riderInfo.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span>{tracking.riderInfo.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Navigation className="w-4 h-4 text-muted-foreground" />
                              <span>{tracking.riderInfo.vehicleInfo}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Current Location */}
                  {tracking.currentLocation && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Current Location
                        </h3>
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Last updated: {format(new Date(tracking.currentLocation.timestamp), 'PPp')}
                          </p>
                          <p className="text-sm">
                            Lat: {tracking.currentLocation.lat.toFixed(6)}, 
                            Lng: {tracking.currentLocation.lng.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Delivery Schedule */}
              {deliverySchedule && (
                <DeliveryScheduleCard 
                  schedule={deliverySchedule} 
                  orderStatus={tracking.status}
                />
              )}

              {/* Order Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* This would be populated with actual order events in a real implementation */}
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <div className="flex-1">
                        <p className="font-medium">Order Placed</p>
                        <p className="text-sm text-muted-foreground">Your order has been received</p>
                      </div>
                    </div>
                    
                    {tracking.status !== 'pending' && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        <div className="flex-1">
                          <p className="font-medium">Order Confirmed</p>
                          <p className="text-sm text-muted-foreground">Payment verified and order confirmed</p>
                        </div>
                      </div>
                    )}

                    {['preparing', 'ready', 'out_for_delivery', 'delivered'].includes(tracking.status) && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        <div className="flex-1">
                          <p className="font-medium">Preparing Order</p>
                          <p className="text-sm text-muted-foreground">Your order is being prepared</p>
                        </div>
                      </div>
                    )}

                    {['out_for_delivery', 'delivered'].includes(tracking.status) && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <div className="flex-1">
                          <p className="font-medium">Out for Delivery</p>
                          <p className="text-sm text-muted-foreground">Your order is on the way</p>
                        </div>
                      </div>
                    )}

                    {tracking.status === 'delivered' && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        <div className="flex-1">
                          <p className="font-medium">Delivered</p>
                          <p className="text-sm text-muted-foreground">Order successfully delivered</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* No search performed yet */}
          {!tracking && !error && !loading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ready to Track Your Order</h3>
                  <p className="text-muted-foreground">
                    Enter your order number above to see real-time tracking information
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}