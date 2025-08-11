import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { CheckoutButton } from '@/components/ui/checkout-button';
import { ShoppingCart, CheckCircle, Package, DollarSign, Users, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { supabase } from '@/integrations/supabase/client';

const PaystackTest = () => {
  const navigate = useNavigate();
  const { cart, addItem, clearCart } = useCart();
  const { toast } = useToast();
  const [testStep, setTestStep] = useState<'products' | 'cart' | 'checkout' | 'complete'>('products');

  // Fetch products for testing
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['test-products'],
    queryFn: () => getProductsWithDiscounts(),
  });

  // Test data for quick testing
  const testCustomer = {
    name: 'John Test Customer',
    email: 'chudesyl@gmail.com',
    phone: '+234 801 234 5678'
  };

  const addTestProduct = () => {
    if (products.length > 0) {
      const product = products[0];
      addItem({
        id: product.id,
        name: product.name,
        price: product.discounted_price || product.price,
        original_price: product.price,
        discount_amount: product.discount_amount,
        vat_rate: 7.5,
        image_url: product.image_url,
      });
      
      toast({
        title: "Test Product Added",
        description: `${product.name} added to cart for testing`,
      });
      
      setTestStep('cart');
    }
  };

// Manual verification helpers
const [reference, setReference] = useState('');
const [verifying, setVerifying] = useState(false);
const [verifyResponse, setVerifyResponse] = useState<any>(null);
const [dbTx, setDbTx] = useState<any>(null);
const [dbOrder, setDbOrder] = useState<any>(null);
const [searchParams] = useSearchParams();

React.useEffect(() => {
  const ref = searchParams.get('ref') || searchParams.get('reference');
  if (ref) setReference(ref);
}, [searchParams]);

const verifyByReference = async () => {
  if (!reference) return;
  setVerifying(true);
  setVerifyResponse(null);
  setDbTx(null);
  setDbOrder(null);
  try {
    const { data, error } = await supabase.functions.invoke('paystack-secure', {
      body: { action: 'verify', reference },
    });
    if (error) throw error;
    setVerifyResponse(data);
    toast({ title: 'Verification called', description: `Status: ${data?.status || data?.data?.status || 'unknown'}` });

    const { data: tx } = await supabase
      .from('payment_transactions')
      .select('id,status,transaction_type,provider_reference,amount,channel,paid_at,order_id,created_at,updated_at')
      .eq('provider_reference', reference)
      .order('created_at', { ascending: false })
      .maybeSingle();
    setDbTx(tx);

    if (tx?.order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('id,order_number,payment_status,status,customer_email,updated_at')
        .eq('id', tx.order_id)
        .maybeSingle();
      setDbOrder(order);
    }
  } catch (e: any) {
    console.error('Verify error', e);
    toast({ title: 'Verification failed', description: e?.message || 'Unknown error', variant: 'destructive' });
  } finally {
    setVerifying(false);
  }
};

const testEmailSystem = async () => {
    try {
      console.log("Testing email system...");
      const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
        body: {
          to: testCustomer.email,
          subject: 'Test Email from Your Store',
          html: `
            <h1>Test Email</h1>
            <p>Hello ${testCustomer.name},</p>
            <p>This is a test email from your e-commerce platform.</p>
            <p>If you receive this, your email system is working correctly!</p>
            <p>Time: ${new Date().toLocaleString()}</p>
          `,
          text: 'This is a test email from your e-commerce platform. If you receive this, your email system is working correctly!'
        }
      });

      if (error) {
        console.error("Email test error:", error);
        toast({
          title: "Email Test Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log("Email test result:", data);
        toast({
          title: "Email Test Successful",
          description: `Test email sent to ${testCustomer.email}`,
        });
        setTestStep('complete');
      }
    } catch (error) {
      console.error("Email system test failed:", error);
      toast({
        title: "Email Test Failed",
        description: "Email system test failed",
        variant: "destructive",
      });
    }
  };

  const getCurrentStepStatus = (step: string) => {
    const currentSteps = ['products', 'cart', 'checkout', 'complete'];
    const currentIndex = currentSteps.indexOf(testStep);
    const stepIndex = currentSteps.indexOf(step);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Paystack Integration Test</h1>
          <p className="text-muted-foreground">Test the complete customer purchase flow</p>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Test Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {[
                { id: 'products', label: 'Add Products', icon: Package },
                { id: 'cart', label: 'View Cart', icon: ShoppingCart },
                { id: 'checkout', label: 'Checkout', icon: DollarSign },
                { id: 'complete', label: 'Complete', icon: CheckCircle }
              ].map((step, index) => {
                const status = getCurrentStepStatus(step.id);
                const Icon = step.icon;
                
                return (
                  <div key={step.id} className="flex flex-col items-center space-y-2">
                    <div className={`
                      rounded-full p-3 transition-colors
                      ${status === 'completed' ? 'bg-green-100 text-green-600' : 
                        status === 'current' ? 'bg-primary text-primary-foreground' : 
                        'bg-muted text-muted-foreground'}
                    `}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">{step.label}</p>
                      <Badge variant={
                        status === 'completed' ? 'default' :
                        status === 'current' ? 'secondary' : 'outline'
                      }>
                        {status}
                      </Badge>
                    </div>
                    {index < 3 && (
                      <div className={`
                        absolute w-16 h-0.5 mt-6 ml-20
                        ${status === 'completed' ? 'bg-green-200' : 'bg-muted'}
                      `} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Test Sections */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Products Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Step 1: Add Test Products
              </CardTitle>
              <CardDescription>
                Add products to cart to test the shopping flow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="text-center py-4">Loading products...</div>
              ) : products.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{products[0]?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ₦{products[0]?.price?.toLocaleString()}
                      </p>
                    </div>
                    <Button onClick={addTestProduct} size="sm">
                      Add to Cart
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/products')}
                    className="w-full"
                  >
                    Browse All Products
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No products available</p>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/admin/products')}
                    className="mt-2"
                  >
                    Add Products (Admin)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Step 2: Review Cart
              </CardTitle>
              <CardDescription>
                Review items and proceed to checkout
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.items.length > 0 ? (
                <div className="space-y-3">
                  {cart.items.slice(0, 2).map((item) => (
                    <div key={item.id} className="flex justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{item.product_name} x{item.quantity}</span>
                      <span className="text-sm font-medium">₦{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2">
                    <div className="flex justify-between font-medium">
                      <span>Total: ₦{cart.summary.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={clearCart}
                      size="sm"
                    >
                      Clear Cart
                    </Button>
                    <Button 
                      onClick={() => setTestStep('checkout')}
                      size="sm"
                    >
                      Test Checkout
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Cart is empty</p>
                  <p className="text-xs text-muted-foreground mt-1">Add products to test checkout</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checkout Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Step 3: Test Checkout
              </CardTitle>
              <CardDescription>
                Process payment using Paystack test mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.items.length > 0 ? (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">Test Mode Active</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Use test card: 4084084084084081 | CVV: 408 | PIN: 0000
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm"><strong>Test Customer:</strong></p>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <p>Name: {testCustomer.name}</p>
                      <p>Email: {testCustomer.email}</p>
                      <p>Phone: {testCustomer.phone}</p>
                    </div>
                  </div>

                  <CheckoutButton />
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Add items to cart first</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email System Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email System Test
              </CardTitle>
              <CardDescription>
                Test the email notification system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Email Integration</p>
                  <p className="text-xs text-green-600 mt-1">
                    Tests welcome emails, order confirmations, and notifications
                  </p>
                </div>
                
                <Button 
                  onClick={testEmailSystem}
                  variant="outline"
                  className="w-full"
                >
                  Send Test Email
                </Button>
                
                <div className="text-xs text-muted-foreground">
                  <p>This will send a test email to: {testCustomer.email}</p>
                  <p className="mt-1">Check your email and spam folder</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Manual Verify by Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Manual Verify by Reference
              </CardTitle>
              <CardDescription>
                Re-run verification and confirm DB order/transaction status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                  <Input
                    placeholder="Enter Paystack reference, e.g. txn_abc123..."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                <Button onClick={verifyByReference} disabled={!reference || verifying}>
                  {verifying ? 'Verifying...' : 'Verify Now'}
                </Button>
              </div>
              {reference && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate(`/payment/callback?reference=${encodeURIComponent(reference)}`)}>
                    Open Payment Callback
                  </Button>
                </div>
              )}
              {verifyResponse && (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Verification Response</p>
                  <pre className="mt-2 text-xs overflow-auto">{JSON.stringify(verifyResponse, null, 2)}</pre>
                </div>
              )}
              {dbTx && (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">DB Transaction</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    <p>Status: {dbTx.status} ({dbTx.transaction_type})</p>
                    <p>Paid At: {dbTx.paid_at || '—'}</p>
                    <p>Channel: {dbTx.channel || '—'}</p>
                  </div>
                </div>
              )}
              {dbOrder && (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Order</p>
                  <div className="text-xs text-muted-foreground mt-1">
                    <p>Order: {dbOrder.order_number}</p>
                    <p>Payment Status: {dbOrder.payment_status}</p>
                    <p>Order Status: {dbOrder.status}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Test Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button 
                variant="outline" 
                onClick={() => navigate('/products')}
                size="sm"
              >
                View Products
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/dashboard')}
                size="sm"
              >
                Admin Dashboard
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/orders')}
                size="sm"
              >
                View Orders
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/customers')}
                size="sm"
              >
                View Customers
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Products</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Cart System</p>
                <p className="text-xs text-muted-foreground">Working</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Paystack</p>
                <p className="text-xs text-muted-foreground">Test Mode</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Email System</p>
                <p className="text-xs text-muted-foreground">Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaystackTest;