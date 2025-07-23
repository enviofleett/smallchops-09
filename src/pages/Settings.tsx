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
                <CardTitle>Developer API Documentation</CardTitle>
                <CardDescription>
                  Complete API documentation for frontend integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Authentication Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Authentication</h3>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Base URL</h4>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        https://oknnklksdiqaifhxaccs.supabase.co
                      </code>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">API Key (Anon)</h4>
                      <code className="bg-muted px-2 py-1 rounded text-sm break-all">
                        eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA
                      </code>
                    </div>
                  </div>

                  {/* Categories API */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Categories API</h3>
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                          <code className="text-sm">/rest/v1/categories</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Get all categories</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                          <code className="text-sm">/rest/v1/categories?id=eq.{'{id}'}</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Get category by ID</p>
                      </div>
                    </div>
                  </div>

                  {/* Products API */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Products API</h3>
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                          <code className="text-sm">/rest/v1/products?status=eq.active</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Get all active products</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                          <code className="text-sm">/rest/v1/products?category_id=eq.{'{category_id}'}</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Get products by category</p>
                      </div>
                    </div>
                  </div>

                  {/* Orders API */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Orders API</h3>
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                          <code className="text-sm">/rest/v1/orders</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Create new order</p>
                        <div className="mt-2 bg-muted/50 p-2 rounded text-xs">
                          <pre>{`{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "+1234567890",
  "order_type": "delivery",
  "delivery_address": "123 Main St",
  "subtotal": 25.99,
  "tax_amount": 2.08,
  "total_amount": 28.07
}`}</pre>
                        </div>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                          <code className="text-sm">/rest/v1/orders?customer_email=eq.{'{email}'}</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Get orders by customer email</p>
                      </div>
                    </div>
                  </div>

                  {/* Order Items API */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Order Items API</h3>
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                          <code className="text-sm">/rest/v1/order_items</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Add items to order</p>
                        <div className="mt-2 bg-muted/50 p-2 rounded text-xs">
                          <pre>{`{
  "order_id": "uuid-here",
  "product_id": "uuid-here",
  "product_name": "Pizza Margherita",
  "quantity": 2,
  "unit_price": 18.99,
  "total_price": 37.98
}`}</pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customers API */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Customers API</h3>
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">POST</span>
                          <code className="text-sm">/rest/v1/customers</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Register new customer</p>
                        <div className="mt-2 bg-muted/50 p-2 rounded text-xs">
                          <pre>{`{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "date_of_birth": "1990-01-01"
}`}</pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Promotions API */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Promotions API</h3>
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                          <code className="text-sm">/rest/v1/promotions?status=eq.active</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Get active promotions</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono">GET</span>
                          <code className="text-sm">/rest/v1/promotions?code=eq.{'{code}'}</code>
                        </div>
                        <p className="text-sm text-muted-foreground">Validate promotion code</p>
                      </div>
                    </div>
                  </div>

                  {/* Headers */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Required Headers</h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div>
                        <code className="text-sm">apikey: YOUR_ANON_KEY</code>
                      </div>
                      <div>
                        <code className="text-sm">Authorization: Bearer YOUR_ANON_KEY</code>
                      </div>
                      <div>
                        <code className="text-sm">Content-Type: application/json</code>
                      </div>
                      <div>
                        <code className="text-sm">Prefer: return=representation</code>
                      </div>
                    </div>
                  </div>

                  {/* Example Usage */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Example: JavaScript Fetch</h3>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <pre className="text-xs overflow-x-auto">{`const response = await fetch('https://oknnklksdiqaifhxaccs.supabase.co/rest/v1/products?status=eq.active', {
  method: 'GET',
  headers: {
    'apikey': 'YOUR_ANON_KEY',
    'Authorization': 'Bearer YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  }
});

const products = await response.json();`}</pre>
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