import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams, useParams } from 'react-router-dom';
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
  Navigation,
  Share2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getRecentGuestOrder, cleanupGuestOrderTracking, logGuestTrackingEvent } from '@/utils/guestCheckoutTracker';

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const { orderNumber } = useParams();
  const [orderIdentifier, setOrderIdentifier] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const { tracking, loading, error, trackOrder } = useDeliveryTracking();

  // Auto-populate search field from URL parameters, route params, and recent guest checkout
  useEffect(() => {
    const orderFromUrl = searchParams.get('order') || searchParams.get('id') || searchParams.get('reference') || orderNumber;
    
    if (orderFromUrl && !searchValue) {
      setSearchValue(orderFromUrl);
      setOrderIdentifier(orderFromUrl);
      trackOrder(orderFromUrl);
      return;
    }

    // Production-ready: Auto-populate for recent guest checkout completions
    if (!orderFromUrl && !searchValue) {
      const guestOrder = getRecentGuestOrder(5); // 5 minute window
      
      if (guestOrder.orderIdentifier) {
        setSearchValue(guestOrder.orderIdentifier);
        setOrderIdentifier(guestOrder.orderIdentifier);
        trackOrder(guestOrder.orderIdentifier);
        
        // Show user-friendly notification
        const message = guestOrder.source === 'session' 
          ? `Auto-loaded your recent order: ${guestOrder.orderIdentifier}`
          : `Found your recent order: ${guestOrder.orderIdentifier}`;
        
        const description = guestOrder.source === 'session'
          ? 'Tracking your order from checkout'
          : 'Continue tracking your delivery';
          
        toast.success(message, { description });
        
        // Production logging and cleanup
        logGuestTrackingEvent('auto_populated', {
          orderIdentifier: guestOrder.orderIdentifier,
          source: guestOrder.source
        });
        
        if (guestOrder.shouldCleanup) {
          cleanupGuestOrderTracking(guestOrder.source!);
        }
        
        return;
      }
      
      // Log monitoring data for debugging
      logGuestTrackingEvent('storage_check', {
        hasSessionStorage: !!sessionStorage.getItem('paymentSuccess'),
        hasLocalStorage: !!localStorage.getItem('lastPaymentSuccess')
      });
    }
  }, [searchParams, orderNumber, trackOrder, searchValue]);

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
      // Update URL without page reload for better UX
      window.history.replaceState({}, '', `/track-order?order=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const handleShareTrackingLink = async () => {
    if (!tracking) return;
    
    const shareUrl = `${window.location.origin}/track/${tracking.orderNumber}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Track Order ${tracking.orderNumber}`,
          text: `Track your order ${tracking.orderNumber} in real-time`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('Link copied to clipboard!');
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

  // Generate dynamic meta tags for order-specific pages
  const pageTitle = tracking 
    ? `Track Order ${tracking.orderNumber} - Real-time Updates`
    : 'Track Your Order - Real-time Delivery Updates';
  
  const pageDescription = tracking
    ? `Track order ${tracking.orderNumber} - Status: ${tracking.status}. Get real-time delivery updates and rider information.`
    : 'Track your order in real-time. Get live updates on your delivery status, estimated arrival time, and rider information.';

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        {tracking && (
          <>
            <meta property="og:title" content={`Order ${tracking.orderNumber} - ${tracking.status}`} />
            <meta property="og:description" content={pageDescription} />
            <meta property="og:url" content={`${window.location.origin}/track/${tracking.orderNumber}`} />
            <meta property="og:type" content="website" />
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:title" content={`Order ${tracking.orderNumber} - ${tracking.status}`} />
            <meta name="twitter:description" content={pageDescription} />
            <link rel="canonical" href={`${window.location.origin}/track/${tracking.orderNumber}`} />
          </>
        )}
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
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(tracking.status)}>
                        {tracking.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShareTrackingLink}
                        className="flex items-center gap-1"
                      >
                        <Share2 className="w-4 h-4" />
                        Share
                      </Button>
                    </div>
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
                            <span className="font-mono text-xs">{tracking.orderId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Order Number:</span>
                            <span className="font-mono">{tracking.orderNumber}</span>
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
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tracking Link:</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleShareTrackingLink}
                              className="h-auto p-1 text-xs text-primary hover:text-primary/80"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy Link
                            </Button>
                          </div>
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

              {/* Enhanced Order Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-2 h-2 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Order Placed</p>
                        <p className="text-sm text-muted-foreground">Your order has been received and is being processed</p>
                      </div>
                      <span className="text-xs text-muted-foreground">✓</span>
                    </div>
                    
                    {tracking.status !== 'pending' && (
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-600 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-2 h-2 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Order Confirmed</p>
                          <p className="text-sm text-muted-foreground">Payment verified and order confirmed</p>
                        </div>
                        <span className="text-xs text-muted-foreground">✓</span>
                      </div>
                    )}

                    {['preparing', 'ready', 'out_for_delivery', 'delivered'].includes(tracking.status) && (
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                          tracking.status === 'preparing' ? 'bg-orange-500' : 'bg-green-600'
                        }`}>
                          {tracking.status === 'preparing' ? (
                            <Clock className="w-2 h-2 text-white" />
                          ) : (
                            <CheckCircle className="w-2 h-2 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Preparing Order</p>
                          <p className="text-sm text-muted-foreground">Your delicious order is being carefully prepared</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {tracking.status === 'preparing' ? '🔄' : '✓'}
                        </span>
                      </div>
                    )}

                    {['out_for_delivery', 'delivered'].includes(tracking.status) && (
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                          tracking.status === 'out_for_delivery' ? 'bg-blue-500' : 'bg-green-600'
                        }`}>
                          {tracking.status === 'out_for_delivery' ? (
                            <Truck className="w-2 h-2 text-white" />
                          ) : (
                            <CheckCircle className="w-2 h-2 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Out for Delivery</p>
                          <p className="text-sm text-muted-foreground">Your order is on the way to you</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {tracking.status === 'out_for_delivery' ? '🚛' : '✓'}
                        </span>
                      </div>
                    )}

                    {tracking.status === 'delivered' && (
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-600 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-2 h-2 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Delivered Successfully! 🎉</p>
                          <p className="text-sm text-muted-foreground">Your order has been delivered. Enjoy your meal!</p>
                        </div>
                        <span className="text-xs text-muted-foreground">✓</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Help & Support Section */}
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold">Need Help?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Having issues with your order? We're here to help.
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href="/contact" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Contact Support
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleShareTrackingLink}>
                        <Share2 className="w-4 h-4 mr-1" />
                        Share Order
                      </Button>
                    </div>
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