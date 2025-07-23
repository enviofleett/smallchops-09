import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandingTab } from "@/components/settings/BrandingTab";
import { AdminUserControl } from "@/components/settings/AdminUserControl";
import { CommunicationsTab } from "@/components/settings/CommunicationsTab";
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
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
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
                      <div className="bg-muted px-3 py-2 rounded text-sm space-y-1">
                        <div>VITE_SUPABASE_URL=https://oknnklksdiqaifhxaccs.supabase.co</div>
                        <div className="break-all">VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA</div>
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