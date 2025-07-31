import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandingTab } from "@/components/settings/BrandingTab";
import { AdminUserControl } from "@/components/settings/AdminUserControl";
import { CommunicationsTab } from "@/components/settings/CommunicationsTab";
import { PaymentSettingsTab } from "@/components/payments/PaymentSettingsTab";


import { Settings as SettingsIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("branding");

  // Check if current user is admin to show admin controls
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const isAdmin = userProfile?.role === 'admin';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your business settings and preferences</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin User Control</TabsTrigger>}
          {isAdmin && <TabsTrigger value="developer">Developer</TabsTrigger>}
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding & Identity</CardTitle>
              <CardDescription>
                Customize your business branding, contact information, and online presence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Communication Settings</CardTitle>
              <CardDescription>
                Configure email and SMS notifications for your customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CommunicationsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
              <CardDescription>
                Configure payment providers and processing options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentSettingsTab />
            </CardContent>
          </Card>
        </TabsContent>


        {isAdmin && (
          <TabsContent value="admin" className="space-y-6">
            <AdminUserControl />
          </TabsContent>
        )}


        {isAdmin && (
          <TabsContent value="developer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Frontend API Integration Guide</CardTitle>
                <CardDescription>
                  Complete guide for integrating your frontend application with the backend APIs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  
                  {/* Quick Start */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">🚀 Quick Start</h3>
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">1. Install Required Dependencies</h4>
                      <code className="bg-muted px-2 py-1 rounded text-sm block">
                        npm install @supabase/supabase-js sonner
                      </code>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">2. Copy API Service Files</h4>
                      <p className="text-sm text-muted-foreground mb-2">Copy these files to your project:</p>
                      <ul className="text-sm space-y-1">
                        <li>• <code>src/api/public.ts</code> - Main API service</li>
                        <li>• <code>src/hooks/useCart.ts</code> - Shopping cart management</li>
                        <li>• <code>src/hooks/useOrderManagement.ts</code> - Order operations</li>
                        <li>• <code>src/hooks/usePayment.ts</code> - Payment processing</li>
                      </ul>
                    </div>
                  </div>

                  {/* Authentication Setup */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">🔐 Authentication Setup</h3>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Environment Configuration</h4>
                      <div className="bg-muted px-3 py-2 rounded text-sm">
                        <div>✅ Supabase URL: Connected</div>
                        <div>✅ Authentication: Configured</div>
                        <div>✅ Database: Connected</div>
                      </div>
                    </div>
                  </div>

                  {/* Core API Endpoints */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">📡 Core API Endpoints</h3>
                    
                    {/* Menu & Products */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">🍕 Menu & Products</h4>
                      <div className="space-y-3">
                        <div className="border-l-4 border-green-500 pl-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                            <code className="text-sm">publicAPI.getCategories()</code>
                          </div>
                          <p className="text-sm text-muted-foreground">Get all menu categories</p>
                        </div>
                        <div className="border-l-4 border-green-500 pl-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                            <code className="text-sm">publicAPI.getProducts(categoryId?)</code>
                          </div>
                          <p className="text-sm text-muted-foreground">Get products, optionally filtered by category</p>
                        </div>
                      </div>
                    </div>

                    {/* Shopping Cart */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">🛒 Shopping Cart</h4>
                      <div className="bg-muted/50 p-3 rounded text-sm">
                        <pre>{`const { cart, addItem, removeItem, clearCart } = useCart();

// Add item to cart
addItem({
  id: 'product-id',
  name: 'Pizza Margherita',
  price: 18.99,
  customizations: { size: 'large' }
}, 2); // quantity

// Cart summary automatically calculated
console.log(cart.summary.total_amount);`}</pre>
                      </div>
                    </div>

                    {/* Order Management */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">📋 Order Management</h4>
                      <div className="space-y-3">
                        <div className="border-l-4 border-blue-500 pl-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                            <code className="text-sm">orderManagement.placeOrder()</code>
                          </div>
                          <div className="bg-muted/50 p-2 rounded text-xs mt-2">
                            <pre>{`const { placeOrder } = useOrderManagement();

const order = await placeOrder(
  {
    customer_name: "John Doe",
    customer_email: "john@example.com", 
    customer_phone: "+1234567890",
    order_type: "delivery",
    delivery_address: "123 Main St"
  },
  cart.items,
  cart.summary
);`}</pre>
                          </div>
                        </div>
                        <div className="border-l-4 border-green-500 pl-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                            <code className="text-sm">orderManagement.trackOrder(orderNumber)</code>
                          </div>
                          <p className="text-sm text-muted-foreground">Track order status with detailed progress</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Processing */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">💳 Payment Processing</h4>
                      <div className="bg-muted/50 p-3 rounded text-sm">
                        <pre>{`const { processPayment } = usePayment();

// Process payment (opens Stripe checkout)
const success = await processPayment(
  orderId,
  cart.summary.total_amount,
  customerEmail,
  true // Open in new tab
);

// Handle payment success
const verification = await handlePaymentSuccess(sessionId, orderId);`}</pre>
                      </div>
                    </div>

                    {/* Promotions */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">🎟️ Promotions & Discounts</h4>
                      <div className="bg-muted/50 p-3 rounded text-sm">
                        <pre>{`// Get active promotions
const promotions = await publicAPI.getActivePromotions();

// Validate promotion code
const discount = await publicAPI.validatePromotion(
  'WELCOME10', 
  cart.summary.subtotal
);

// Apply discount to cart
updateCartSummary(discount.data.discount_amount, orderType);`}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Integration Examples */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">💡 Integration Examples</h3>
                    
                    <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Complete Checkout Flow</h4>
                      <div className="bg-muted p-3 rounded text-xs overflow-x-auto">
                        <pre>{`import { useCart } from './hooks/useCart';
import { useOrderManagement } from './hooks/useOrderManagement';
import { usePayment } from './hooks/usePayment';

function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const { placeOrder } = useOrderManagement();
  const { processPayment } = usePayment();

  const handleCheckout = async (customerData) => {
    try {
      // 1. Create order
      const order = await placeOrder(customerData, cart.items, cart.summary);
      
      // 2. Process payment
      const paymentSuccess = await processPayment(
        order.id,
        cart.summary.total_amount,
        customerData.customer_email
      );
      
      if (paymentSuccess) {
        // 3. Clear cart and redirect
        clearCart();
        router.push(\`/order-tracking/\${order.order_number}\`);
      }
    } catch (error) {
      console.error('Checkout failed:', error);
    }
  };

  return (
    <form onSubmit={handleCheckout}>
      {/* Checkout form */}
    </form>
  );
}`}</pre>
                      </div>
                    </div>

                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Order Tracking Component</h4>
                      <div className="bg-muted p-3 rounded text-xs overflow-x-auto">
                        <pre>{`function OrderTracker({ orderNumber }) {
  const { trackOrder } = useOrderManagement();
  const [tracking, setTracking] = useState(null);

  useEffect(() => {
    const loadTracking = async () => {
      try {
        const trackingInfo = await trackOrder(orderNumber);
        setTracking(trackingInfo);
      } catch (error) {
        console.error('Failed to load tracking:', error);
      }
    };
    
    loadTracking();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(loadTracking, 30000);
    return () => clearInterval(interval);
  }, [orderNumber]);

  return (
    <div>
      <h2>Order #{tracking?.orderNumber}</h2>
      <p>Status: {tracking?.status}</p>
      <p>Estimated Time: {tracking?.estimatedTime}</p>
      
      <div className="steps">
        {tracking?.trackingSteps.map((step, index) => (
          <div key={index} className={step.completed ? 'completed' : 'pending'}>
            {step.step}
          </div>
        ))}
      </div>
    </div>
  );
}`}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Error Handling */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">⚠️ Error Handling</h3>
                    <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                      <div className="bg-muted p-3 rounded text-sm">
                        <pre>{`// All API calls include error handling
try {
  const result = await publicAPI.createOrder(orderData);
  if (!result.success) {
    throw new Error(result.error);
  }
  // Handle success
} catch (error) {
  // Error automatically shown via toast
  console.error('Order creation failed:', error.message);
}

// Payment errors are handled automatically
const { processPayment, handlePaymentError } = usePayment();

// Custom error handling
if (!paymentSuccess) {
  handlePaymentError('Custom error message');
}`}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Live Testing */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">🧪 Live Testing</h3>
                    <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Test Data Available</h4>
                      <ul className="text-sm space-y-1">
                        <li>• <strong>8 Categories:</strong> Pizza, Burgers, Pasta, Salads, Appetizers, Desserts, Beverages, Seafood</li>
                        <li>• <strong>30 Products:</strong> Full menu with prices and descriptions</li>
                        <li>• <strong>15 Sample Customers:</strong> For testing customer registration</li>
                        <li>• <strong>4 Active Promotions:</strong> Including WELCOME10, FREEDEL, PIZZA20, WEEKEND15</li>
                        <li>• <strong>Payment Testing:</strong> Use Stripe test cards (4242 4242 4242 4242)</li>
                      </ul>
                    </div>
                  </div>

                  {/* Customer Favorites */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">❤️ Customer Favorites</h3>
                    
                    {/* Database Schema */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">📊 Database Schema</h4>
                      <div className="bg-muted/50 p-3 rounded text-sm">
                        <pre>{`-- customer_favorites table
CREATE TABLE customer_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- RLS Policies enabled for secure customer access
-- Customers can only manage their own favorites`}</pre>
                      </div>
                    </div>

                    {/* API Endpoints */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">🔗 API Endpoints</h4>
                      <div className="space-y-3">
                        <div className="border-l-4 border-green-500 pl-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                            <code className="text-sm">/customers/:id/favorites</code>
                          </div>
                          <p className="text-sm text-muted-foreground">Get customer's favorite products with full product details</p>
                          <div className="bg-muted/50 p-2 rounded text-xs mt-2">
                            <pre>{`// Response
{
  "success": true,
  "data": [
    {
      "id": "product-uuid",
      "name": "Pizza Margherita",
      "price": 18.99,
      "image_url": "...",
      "category": { "id": "...", "name": "Pizza" },
      "favorite_id": "favorite-uuid",
      "favorited_at": "2024-01-15T10:30:00Z"
    }
  ]
}`}</pre>
                          </div>
                        </div>
                        
                        <div className="border-l-4 border-blue-500 pl-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                            <code className="text-sm">/customers/:id/favorites</code>
                          </div>
                          <p className="text-sm text-muted-foreground">Add product to customer's favorites</p>
                          <div className="bg-muted/50 p-2 rounded text-xs mt-2">
                            <pre>{`// Request Body
{
  "product_id": "product-uuid"
}

// Response
{
  "success": true,
  "data": {
    "id": "favorite-uuid",
    "customer_id": "customer-uuid", 
    "product_id": "product-uuid",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Product added to favorites"
}`}</pre>
                          </div>
                        </div>
                        
                        <div className="border-l-4 border-red-500 pl-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-mono">DELETE</span>
                            <code className="text-sm">/customers/:id/favorites/:product_id</code>
                          </div>
                          <p className="text-sm text-muted-foreground">Remove product from customer's favorites</p>
                          <div className="bg-muted/50 p-2 rounded text-xs mt-2">
                            <pre>{`// Response
{
  "success": true,
  "message": "Product removed from favorites"
}`}</pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Frontend Integration */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">⚛️ Frontend Integration</h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="font-medium text-sm mb-2">React Hooks</h5>
                          <div className="bg-muted/50 p-3 rounded text-sm">
                            <pre>{`import { useCustomerFavorites, useIsFavorite } from './hooks/useCustomerFavorites';

// Manage customer favorites
const { 
  favorites, 
  isLoading, 
  addFavorite, 
  removeFavorite 
} = useCustomerFavorites(customerId);

// Check if single product is favorite
const { data: isFavorite } = useIsFavorite(customerId, productId);

// Bulk check for multiple products
const { data: favoritesMap } = useFavoritesByProducts(customerId, productIds);`}</pre>
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-sm mb-2">Favorite Button Component</h5>
                          <div className="bg-muted/50 p-3 rounded text-sm">
                            <pre>{`import { FavoriteButton } from '@/components/ui/favorite-button';

<FavoriteButton
  isFavorite={isFavorite}
  isLoading={isLoading}
  onToggle={() => {
    if (isFavorite) {
      removeFavorite.mutate(productId);
    } else {
      addFavorite.mutate(productId);
    }
  }}
  size="md" // sm, md, lg
  className="absolute top-2 right-2"
/>`}</pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Implementation Examples */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">💡 Implementation Examples</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Product Card with Favorites</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`function ProductCard({ product, customerId }) {
  const { data: isFavorite } = useIsFavorite(customerId, product.id);
  const { addFavorite, removeFavorite } = useCustomerFavorites(customerId);

  const handleToggleFavorite = () => {
    if (isFavorite) {
      removeFavorite.mutate(product.id);
    } else {
      addFavorite.mutate(product.id);
    }
  };

  return (
    <div className="relative product-card">
      <img src={product.image_url} alt={product.name} />
      
      <FavoriteButton
        isFavorite={isFavorite}
        isLoading={addFavorite.isPending || removeFavorite.isPending}
        onToggle={handleToggleFavorite}
        className="absolute top-2 right-2"
      />
      
      <div className="p-4">
        <h3>{product.name}</h3>
        <p>\${product.price}</p>
        <button onClick={() => addToCart(product)}>
          Add to Cart
        </button>
      </div>
    </div>
  );
}`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Customer Favorites Page</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`function CustomerFavorites({ customerId }) {
  const { favorites, isLoading, removeFavorite } = useCustomerFavorites(customerId);
  const { addItem } = useCart();

  if (isLoading) return <div>Loading favorites...</div>;
  
  if (favorites?.length === 0) {
    return (
      <div className="text-center py-8">
        <h3>No favorites yet</h3>
        <p>Start adding products to your favorites!</p>
      </div>
    );
  }

  return (
    <div className="favorites-grid">
      {favorites?.map((product) => (
        <FavoriteProductCard
          key={product.id}
          product={product}
          onRemoveFromFavorites={(productId) => removeFavorite.mutate(productId)}
          onAddToCart={(product) => addItem(product, 1)}
          isRemoving={removeFavorite.isPending}
        />
      ))}
    </div>
  );
}`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Bulk Favorites Check</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`function ProductList({ products, customerId }) {
  const productIds = products.map(p => p.id);
  const { data: favoritesMap } = useFavoritesByProducts(customerId, productIds);

  return (
    <div className="product-list">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isFavorite={favoritesMap?.[product.id] || false}
          customerId={customerId}
        />
      ))}
    </div>
  );
}`}</pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Favorites System */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">🌟 Enhanced Favorites System with Price Tracking</h4>
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded mb-3">
                        <p className="text-sm">Complete customer favorites system with price tracking, email notifications, and dedicated favorites page.</p>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Dedicated Favorites Page</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// Route: /favorites - Complete favorites management page
import { CustomerFavorites } from '@/pages/CustomerFavorites';

// Features:
// - Search within favorites
// - Category filtering  
// - Grid/List view toggle
// - Bulk operations (add to cart, remove)
// - Notification preferences modal
// - Empty state with call-to-action

<Route path="/favorites" element={<CustomerFavorites />} />`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Price Tracking System</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// Automatic price change detection via database triggers
// Table: product_price_history - tracks all price changes
// Table: notification_queue - queues email notifications

// When product price changes:
// 1. Trigger logs price change in history
// 2. Finds customers with product in favorites
// 3. Checks notification preferences
// 4. Queues email if discount meets threshold

// Database schema:
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Customer Notification Preferences</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// Notification preferences management
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

function NotificationSettings({ customerId }) {
  const { 
    preferences, 
    updatePreferences, 
    isLoading 
  } = useNotificationPreferences(customerId);

  const handleSave = (data) => {
    updatePreferences({
      customer_id: customerId,
      price_alerts: data.priceAlerts,
      promotion_alerts: data.promotionAlerts,
      digest_frequency: data.digestFrequency,
      minimum_discount_percentage: data.minimumDiscount
    });
  };

  // Settings include:
  // - Price alerts on/off
  // - Promotion alerts on/off
  // - Digest frequency (daily/weekly/monthly)
  // - Minimum discount threshold (1-50%)
}`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Email Notification System</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// Edge Functions for email processing
// 1. process-price-notifications - Processes price change alerts
// 2. check-promotion-alerts - Handles promotion notifications

// Professional email templates with:
// - Product name and images
// - Old vs new price comparison
// - Percentage discount calculation
// - Direct link to product/favorites page
// - Unsubscribe options

// Background processing:
// - Automatic queue processing every 15 minutes
// - Batched email sending for efficiency
// - Error handling and retry logic
// - Delivery status tracking`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Enhanced UI Components</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// FavoritesHeader - Search, filter, view controls
import { FavoritesHeader } from '@/components/favorites/FavoritesHeader';

// FavoriteProductGrid - Responsive grid/list display
import { FavoriteProductGrid } from '@/components/favorites/FavoriteProductGrid';

// NotificationPreferences - Settings modal
import { NotificationPreferences } from '@/components/favorites/NotificationPreferences';

// FavoritesEmptyState - Empty state with CTA
import { FavoritesEmptyState } from '@/components/favorites/FavoritesEmptyState';

// Usage in favorites page:
<FavoritesHeader
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  selectedCategory={selectedCategory}
  onCategoryChange={setSelectedCategory}
  categories={categories}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  favoritesCount={favorites.length}
  onShowNotificationSettings={handleShowSettings}
/>

<FavoriteProductGrid
  favorites={filteredFavorites}
  viewMode={viewMode}
  onRemoveFromFavorites={handleRemove}
  isRemoving={isRemoving}
/>`}</pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Advanced Features */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">🚀 Advanced Features</h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Smart Filtering & Search</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// Advanced filtering within favorites
const filteredFavorites = favorites.filter(favorite => {
  const matchesSearch = favorite.name
    .toLowerCase()
    .includes(searchQuery.toLowerCase());
  
  const matchesCategory = selectedCategory === 'all' || 
    favorite.category_id === selectedCategory;
  
  return matchesSearch && matchesCategory;
});

// Category-based filtering with counts
const categoryStats = categories.map(category => ({
  ...category,
  count: favorites.filter(f => f.category_id === category.id).length
}));`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Bulk Operations</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// Add multiple favorites to cart
const handleBulkAddToCart = (favorites) => {
  favorites.forEach(favorite => {
    addItem({
      id: favorite.id,
      name: favorite.name,
      price: favorite.price,
    });
  });
  toast.success(\`Added \${favorites.length} items to cart\`);
};

// Remove multiple favorites
const handleBulkRemove = async (favoriteIds) => {
  for (const id of favoriteIds) {
    await removeFavorite.mutateAsync(id);
  }
  toast.success(\`Removed \${favoriteIds.length} favorites\`);
};`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Error Handling</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// Hooks automatically handle errors and show toast notifications
const { addFavorite, removeFavorite } = useCustomerFavorites(customerId);

// Add favorite with error handling
addFavorite.mutate(productId, {
  onError: (error) => {
    if (error.message.includes('already in favorites')) {
      toast.info('Product is already in your favorites');
    } else {
      toast.error('Failed to add to favorites');
    }
  }
});`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Performance Optimization</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// React Query automatically handles:
// - Caching favorites data
// - Background refetching
// - Optimistic updates
// - Query invalidation after mutations

// Manual cache invalidation if needed
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['customer-favorites', customerId] });`}</pre>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-sm mb-2">Analytics Integration</h5>
                          <div className="bg-muted/50 p-3 rounded text-xs">
                            <pre>{`// Track favorite events for analytics
const handleAddFavorite = (productId) => {
  addFavorite.mutate(productId, {
    onSuccess: () => {
      // Track analytics event
      analytics.track('product_favorited', {
        product_id: productId,
        customer_id: customerId,
        timestamp: new Date().toISOString()
      });
    }
  });
};`}</pre>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Testing */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">🧪 Testing Guide</h4>
                      <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded">
                        <h5 className="font-medium text-sm mb-2">Test Scenarios</h5>
                        <ul className="text-sm space-y-1">
                          <li>• Add product to favorites (success case)</li>
                          <li>• Try to add duplicate favorite (error handling)</li>
                          <li>• Remove product from favorites</li>
                          <li>• Load customer favorites list</li>
                          <li>• Check favorite status for multiple products</li>
                          <li>• Handle network errors gracefully</li>
                        </ul>
                      </div>
                      
                      <div className="bg-muted/50 p-3 rounded text-xs mt-3">
                        <pre>{`// Sample test data
const testCustomerId = "customer-uuid";
const testProductId = "product-uuid";

// Test adding favorite
POST /customers/customer-uuid/favorites
Body: { "product_id": "product-uuid" }

// Test getting favorites
GET /customers/customer-uuid/favorites

// Test removing favorite  
DELETE /customers/customer-uuid/favorites/product-uuid`}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Support */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">🆘 Support & Documentation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-3">
                        <h4 className="font-medium">API Response Format</h4>
                        <div className="bg-muted p-2 rounded text-xs mt-2">
                          <pre>{`{
  "success": true,
  "data": { ... },
  "message": "Success message"
}

// Error format
{
  "success": false,
  "error": "Error description"
}`}</pre>
                        </div>
                      </div>
                      <div className="border rounded-lg p-3">
                        <h4 className="font-medium">Rate Limits</h4>
                        <ul className="text-sm mt-2 space-y-1">
                          <li>• Public APIs: No authentication required</li>
                          <li>• Payment APIs: Stripe rate limits apply</li>
                          <li>• Email APIs: MailerSend limits apply</li>
                          <li>• Real-time updates via Supabase realtime</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;