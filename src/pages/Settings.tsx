import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BrandingTab } from "@/components/settings/BrandingTab";
import { AdminUserControl } from "@/components/settings/AdminUserControl";
import { CommunicationsTab } from "@/components/settings/CommunicationsTab";
import { PaymentSettingsTab } from "@/components/payments/PaymentSettingsTab";
import { ContentManagementTab } from "@/components/blog/ContentManagementTab";
import { EmailProcessingTab } from "@/components/settings/EmailProcessingTab";
import { Settings as SettingsIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryZoneDevTools } from "@/components/settings/DeliveryZoneDevTools";
import { AuthenticationEndpointsTab } from "@/components/settings/AuthenticationEndpointsTab";
import { BuyingLogicEndpointsTab } from "@/components/settings/BuyingLogicEndpointsTab";
import RegistrationHealth from "./RegistrationHealth";
const Settings = () => {
  const [activeTab, setActiveTab] = useState("communications");

  // Check if current user is admin to show admin controls
  const {
    data: userProfile
  } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return null;
      const {
        data,
        error
      } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (error) throw error;
      return data;
    }
  });
  const isAdmin = userProfile?.role === 'admin';
  return <div className="container mx-auto py-4 md:py-6 space-y-6 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
          <SettingsIcon className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your business settings and preferences</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-2">
          <TabsList className="grid w-full min-w-[480px] grid-cols-4 lg:grid-cols-6 lg:min-w-0">
            <TabsTrigger value="communications" className="text-xs sm:text-sm">Comms</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
            <TabsTrigger value="customer-registration" className="text-xs sm:text-sm">Customer</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin" className="text-xs sm:text-sm">Admin</TabsTrigger>}
            {isAdmin && <TabsTrigger value="developer" className="text-xs sm:text-sm">Dev</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="communications" className="space-y-6">
          <Tabs defaultValue="branding" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="email-processing">Queue</TabsTrigger>
            </TabsList>
            
            <TabsContent value="branding">
              <Card>
                <CardContent className="pt-6">
                  <BrandingTab />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="email">
              <Card>
                
                <CardContent>
                  <CommunicationsTab />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="content">
              <ContentManagementTab />
            </TabsContent>
            
            <TabsContent value="email-processing">
              <Card>
                <CardHeader>
                  <CardTitle>Email Queue Processing</CardTitle>
                  <CardDescription>
                    Monitor and manage email queue processing and delivery
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmailProcessingTab />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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


        <TabsContent value="customer-registration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Registration Requirements</CardTitle>
              <CardDescription>
                Manage customer registration validation rules and requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Registration Requirements</h3>
                  <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span><strong>Phone Number:</strong> Required field for all new customer registrations</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span><strong>Validation:</strong> Minimum 10 digits, alphanumeric characters allowed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span><strong>Database:</strong> Phone field is set as NOT NULL in customer_accounts table</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">⚠️ Registration Process</h3>
                  <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                    <p><strong>Frontend Validation:</strong> The customer registration form validates phone numbers client-side before submission.</p>
                    <p><strong>Server Validation:</strong> Database triggers ensure phone numbers are provided during user registration.</p>
                    <p><strong>Error Handling:</strong> Clear error messages guide customers to provide valid phone numbers.</p>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">💻 Technical Implementation</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Database Constraints</h4>
                      <div className="bg-muted p-3 rounded text-xs">
                        <pre>{`-- customer_accounts table constraints
ALTER TABLE customer_accounts 
ALTER COLUMN phone SET NOT NULL;

-- Validation trigger
CREATE FUNCTION handle_new_customer_auth()
RETURNS trigger AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'phone' IS NULL THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;
  -- Insert customer account with required phone
END;`}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-2">Frontend Validation</h4>
                      <div className="bg-muted p-3 rounded text-xs">
                        <pre>{`// Customer registration form validation
if (!signupData.phone || signupData.phone.trim().length < 10) {
  toast({
    title: "Phone number required",
    description: "Please enter a valid phone number with at least 10 digits.",
    variant: "destructive",
  });
  return;
}`}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">✅ Contact Information Display</h3>
                  <div className="space-y-2 text-sm text-green-800 dark:text-green-200">
                    <p><strong>Customer Table:</strong> Both email and phone number are displayed in the contact column for easy reference.</p>
                    <p><strong>Customer Details:</strong> Full contact information is available in customer detail views.</p>
                    <p><strong>Data Integrity:</strong> All registered customers now have complete contact information for better customer service.</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">📞 Benefits of Required Phone Numbers</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                      <span><strong>Better Customer Support:</strong> Multiple contact methods for customer service</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                      <span><strong>Order Communications:</strong> SMS notifications for order updates and delivery</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                      <span><strong>Account Recovery:</strong> Additional verification method for password resets</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                      <span><strong>Fraud Prevention:</strong> Better customer verification and security</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && <TabsContent value="admin" className="space-y-6">
            <AdminUserControl />
          </TabsContent>}


        {isAdmin && <TabsContent value="developer" className="space-y-6">
            <Tabs defaultValue="auth-endpoints" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="auth-endpoints">Auth API</TabsTrigger>
                <TabsTrigger value="buying-logic">Buying Logic</TabsTrigger>
                <TabsTrigger value="oauth">OAuth Config</TabsTrigger>
                <TabsTrigger value="registration-health">Registration Health</TabsTrigger>
              </TabsList>
              
              <TabsContent value="auth-endpoints">
                <AuthenticationEndpointsTab />
              </TabsContent>
              
              <TabsContent value="buying-logic">
                <BuyingLogicEndpointsTab />
              </TabsContent>
              
              <TabsContent value="oauth">
                <Card>
                  <CardHeader>
                    <CardTitle>Google OAuth Configuration</CardTitle>
                    <CardDescription>
                      Setup Google OAuth authentication for customer login
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                <div className="space-y-6">
                  
                  {/* Google OAuth Setup Instructions */}
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">🔐 Google OAuth Setup Instructions</h3>
                    <div className="space-y-4 text-sm text-blue-800 dark:text-blue-200">
                      <div>
                        <h4 className="font-medium mb-2">1. Google Cloud Console Setup</h4>
                        <ul className="space-y-1 ml-4">
                          <li>• Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                          <li>• Create a new project or select existing project</li>
                          <li>• Enable the Google+ API</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">2. OAuth Consent Screen</h4>
                        <ul className="space-y-1 ml-4">
                          <li>• Go to APIs & Services → OAuth consent screen</li>
                          <li>• Choose "External" user type</li>
                          <li>• Add authorized domains: <code className="bg-muted px-1 py-0.5 rounded">oknnklksdiqaifhxaccs.supabase.co</code></li>
                          <li>• Add your production domain when ready</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">3. Create OAuth Credentials</h4>
                        <ul className="space-y-1 ml-4">
                          <li>• Go to APIs & Services → Credentials</li>
                          <li>• Click "Create Credentials" → "OAuth Client ID"</li>
                          <li>• Choose "Web application"</li>
                          <li>• Add JavaScript origins and redirect URIs (see below)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Required URLs */}
                  <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3">🌐 Required URLs for Google OAuth</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <h4 className="font-medium text-green-800 dark:text-green-200 mb-1">Authorized JavaScript Origins:</h4>
                        <div className="bg-muted p-2 rounded font-mono text-xs space-y-1">
                          <div>https://oknnklksdiqaifhxaccs.supabase.co</div>
                          <div>http://localhost:3000 (for development)</div>
                          <div>https://your-production-domain.com (when live)</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-green-800 dark:text-green-200 mb-1">Authorized Redirect URIs:</h4>
                        <div className="bg-muted p-2 rounded font-mono text-xs space-y-1">
                          <div>https://oknnklksdiqaifhxaccs.supabase.co/auth/v1/callback</div>
                          <div>http://localhost:54321/auth/v1/callback (for local dev)</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Supabase Configuration */}
                  <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3">⚙️ Supabase Dashboard Configuration</h3>
                    <div className="space-y-3 text-sm text-amber-800 dark:text-amber-200">
                      <div>
                        <h4 className="font-medium mb-2">1. Enable Google Provider</h4>
                        <ul className="space-y-1 ml-4">
                          <li>• Go to Supabase Dashboard → Authentication → Providers</li>
                          <li>• Enable Google provider</li>
                          <li>• Add your Google OAuth Client ID and Secret</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">2. Configure Redirect URLs</h4>
                        <ul className="space-y-1 ml-4">
                          <li>• Go to Authentication → URL Configuration</li>
                          <li>• Set Site URL: <code className="bg-muted px-1 py-0.5 rounded">https://your-domain.com</code></li>
                          <li>• Add Redirect URLs for each environment</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Implementation Status */}
                  <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">✅ Implementation Status</h3>
                    <div className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span>Google OAuth button added to customer login modal</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span>Google OAuth button added to customer signup modal</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span>Automatic customer account creation for Google users</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span>Redirect to customer portal after successful authentication</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        <span>Requires Google OAuth credentials configuration in Supabase</span>
                      </div>
                    </div>
                  </div>

                  {/* Security & Production Notes */}
                  <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                    <h3 className="font-semibold text-red-900 dark:text-red-100 mb-3">🔒 Security & Production Checklist</h3>
                    <div className="space-y-2 text-sm text-red-800 dark:text-red-200">
                      <div className="flex items-start space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full mt-2"></span>
                        <span><strong>Domain Verification:</strong> Ensure all domains are verified in Google Cloud Console</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full mt-2"></span>
                        <span><strong>SSL/HTTPS:</strong> All URLs must use HTTPS in production</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full mt-2"></span>
                        <span><strong>Privacy Policy:</strong> Required for Google OAuth consent screen</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full mt-2"></span>
                        <span><strong>Terms of Service:</strong> Required for production OAuth app</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full mt-2"></span>
                        <span><strong>Scope Minimization:</strong> Only request necessary permissions (email, profile)</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">🔗 Quick Links</h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 p-2 border rounded hover:bg-muted transition-colors">
                        <span>Google Cloud Credentials</span>
                        <span className="text-xs">↗</span>
                      </a>
                      <a href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/auth/providers" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 p-2 border rounded hover:bg-muted transition-colors">
                        <span>Supabase Auth Providers</span>
                        <span className="text-xs">↗</span>
                      </a>
                      <a href="https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/auth/url-configuration" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 p-2 border rounded hover:bg-muted transition-colors">
                        <span>Supabase URL Config</span>
                        <span className="text-xs">↗</span>
                      </a>
                      <a href="https://supabase.com/docs/guides/auth/social-login/auth-google" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 p-2 border rounded hover:bg-muted transition-colors">
                        <span>Supabase Google Auth Docs</span>
                        <span className="text-xs">↗</span>
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

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

                    {/* OTP Authentication */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">🔐 OTP Authentication System</h4>
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                          <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Overview</h5>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Email-based One-Time Password authentication for secure login, registration verification, and password reset.
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          <h5 className="font-medium">Frontend Integration</h5>
                          <div className="bg-muted/50 p-3 rounded text-sm">
                             <pre>{`import { useCustomerDirectAuth } from '@/hooks/useCustomerDirectAuth';

const { login, register, isLoading } = useCustomerDirectAuth();

// Login with email/password
const result = await login(
  'user@example.com',
  'login',
  'John Doe' // optional customer name
);

// Verify OTP code
const verification = await verifyOTP(
  'user@example.com',
  '123456',
  'login'
);

if (verification.success && verification.loginVerified) {
  // User successfully authenticated
}`}</pre>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-medium">API Reference</h5>
                          <div className="space-y-2">
                            <div className="border-l-4 border-blue-500 pl-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                                <code className="text-sm">generate-otp-email</code>
                              </div>
                              <p className="text-sm text-muted-foreground">Generate and send OTP via email</p>
                              <div className="bg-muted/30 p-2 rounded text-xs mt-2">
                                <pre>{`{
  "email": "user@example.com",
  "purpose": "login|registration|password_reset",
  "customerName": "John Doe" // optional
}`}</pre>
                              </div>
                            </div>
                            <div className="border-l-4 border-green-500 pl-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                                <code className="text-sm">verify-otp</code>
                              </div>
                              <p className="text-sm text-muted-foreground">Verify OTP code</p>
                              <div className="bg-muted/30 p-2 rounded text-xs mt-2">
                                <pre>{`{
  "email": "user@example.com",
  "code": "123456",
  "purpose": "login|registration|password_reset"
}`}</pre>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-medium">Security Features</h5>
                          <ul className="text-sm space-y-1">
                            <li>• Rate limiting: 5 OTPs per hour per email</li>
                            <li>• 6-digit numeric codes with 5-minute expiration</li>
                            <li>• Maximum 3 verification attempts per OTP</li>
                            <li>• Automatic cleanup of expired codes</li>
                            <li>• Purpose-specific verification (login/registration/reset)</li>
                          </ul>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-medium">Complete Implementation Example</h5>
                          <div className="bg-muted/50 p-3 rounded text-sm">
                             <pre>{`// Login with direct authentication
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useCustomerDirectAuth();

  const handleLogin = async () => {
    const result = await login(email, password);
    if (result.success) {
      setOtpSent(true);
    }
  };

  const handleVerifyOTP = async (code: string) => {
    const result = await completeOTPLogin(email, code);
    if (result.success && result.loginVerified) {
      // Redirect to dashboard or update auth state
      window.location.href = '/dashboard';
    }
  };

  return otpSent ? (
    <OTPInput
      email={email}
      purpose="login"
      onVerified={handleVerifyOTP}
      onBack={() => setOtpSent(false)}
    />
  ) : (
    <LoginForm onSubmit={handleSendOTP} />
  );
};`}</pre>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-medium">Error Handling</h5>
                          <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg">
                            <div className="text-sm space-y-2">
                              <div><code>rateLimited</code> - Too many OTP requests</div>
                              <div><code>expired</code> - OTP code has expired</div>
                              <div><code>invalidCode</code> - Wrong OTP code entered</div>
                              <div><code>maxAttemptsReached</code> - Too many failed attempts</div>
                              <div><code>notFound</code> - No valid OTP found for email</div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="font-medium">Database Schema</h5>
                          <div className="bg-muted/50 p-3 rounded text-sm">
                            <pre>{`-- email_otp_verification table
CREATE TABLE email_otp_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  is_verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz
);

-- Automatic cleanup of expired OTPs
SELECT cleanup_expired_otps();

-- Rate limiting check
SELECT check_otp_rate_limit('email@example.com', 'login');`}</pre>
                          </div>
                        </div>
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

                  <Separator className="my-8" />
                  
                  {/* Delivery Zone Development Tools */}
                  <DeliveryZoneDevTools />

                </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="registration-health">
                <Card>
                  <CardHeader>
                    <CardTitle>Registration System Monitoring</CardTitle>
                    <CardDescription>
                      Monitor and debug customer registration system health
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RegistrationHealth />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>}
      </Tabs>
    </div>;
};
export default Settings;