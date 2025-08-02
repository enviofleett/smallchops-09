import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, CheckCircle, ExternalLink, Play, User, ShoppingCart, CreditCard, Package, Truck, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

export const BuyingLogicEndpointsTab = () => {
  const [testOrderId, setTestOrderId] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const endpoints = [
    // Guest Checkout Endpoints
    {
      category: 'Guest Checkout',
      icon: <User className="w-4 h-4" />,
      items: [
        {
          method: 'POST',
          path: '/api/guest-checkout/cart',
          description: 'Add items to guest cart (session-based)',
          body: {
            items: [
              {
                product_id: 'string',
                quantity: 'number',
                customizations: 'object'
              }
            ]
          },
          response: {
            success: true,
            cart: {
              items: 'CartItem[]',
              summary: 'OrderSummary'
            }
          }
        },
        {
          method: 'POST',
          path: '/api/guest-checkout/place-order',
          description: 'Place order as guest (no authentication required)',
          body: {
            customer_name: 'string',
            customer_email: 'string', 
            customer_phone: 'string',
            order_type: '"delivery" | "pickup"',
            delivery_address: 'string (required for delivery)',
            delivery_zone_id: 'string (required for delivery)',
            special_instructions: 'string',
            items: 'CartItem[]',
            summary: 'OrderSummary'
          },
          response: {
            success: true,
            order_id: 'string',
            order_number: 'string',
            payment_url: 'string'
          }
        }
      ]
    },
    // Order Management
    {
      category: 'Order Management',
      icon: <Package className="w-4 h-4" />,
      items: [
        {
          method: 'PUT',
          path: '/api/orders/{id}/status',
          description: 'Update order status (Admin only)',
          auth: 'Bearer JWT (Admin)',
          body: {
            status: '"preparing" | "ready" | "out_for_delivery" | "delivered" | "completed"',
            assigned_rider_id: 'string (optional)',
            notes: 'string (optional)'
          },
          response: {
            success: true,
            order: 'OrderWithItems'
          }
        },
        {
          method: 'POST',
          path: '/api/orders/{id}/assign-rider',
          description: 'Assign dispatch rider to delivery order',
          auth: 'Bearer JWT (Admin)',
          body: {
            rider_id: 'string',
            estimated_delivery_time: 'string'
          }
        },
        {
          method: 'GET',
          path: '/api/orders/{id}/track',
          description: 'Track order status (Public endpoint)',
          response: {
            order_id: 'string',
            status: 'string',
            tracking_steps: 'TrackingStep[]',
            rider_info: 'RiderInfo (if assigned)'
          }
        }
      ]
    },
    // Email Notifications
    {
      category: 'Email Notifications',
      icon: <CheckCircle className="w-4 h-4" />,
      items: [
        {
          method: 'POST',
          path: 'functions/order-confirmation-email',
          description: 'Send order confirmation email (Auto-triggered)',
          trigger: 'Database trigger on order creation',
          template: 'order_confirmation',
          variables: {
            order_number: 'string',
            customer_name: 'string',
            items: 'OrderItem[]',
            total_amount: 'number',
            order_type: 'string'
          }
        },
        {
          method: 'POST',
          path: 'functions/order-ready-email',
          description: 'Send order ready for pickup email',
          trigger: 'Status change to "ready"',
          template: 'order_ready_pickup',
          variables: {
            order_number: 'string',
            customer_name: 'string',
            pickup_location: 'string',
            preparation_time: 'string'
          }
        },
        {
          method: 'POST',
          path: 'functions/order-shipped-email', 
          description: 'Send order shipped/rider assigned email',
          trigger: 'Rider assignment',
          template: 'order_shipped',
          variables: {
            order_number: 'string',
            customer_name: 'string',
            rider_name: 'string',
            rider_phone: 'string',
            tracking_url: 'string'
          }
        },
        {
          method: 'POST',
          path: 'functions/order-completed-email',
          description: 'Send thank you email after completion',
          trigger: 'Status change to "completed"',
          template: 'order_completed',
          variables: {
            order_number: 'string',
            customer_name: 'string',
            order_type: 'string',
            review_url: 'string'
          }
        }
      ]
    },
    // Payment Integration
    {
      category: 'Payment Integration',
      icon: <CreditCard className="w-4 h-4" />,
      items: [
        {
          method: 'POST',
          path: 'functions/paystack-initialize',
          description: 'Initialize payment for order',
          body: {
            order_id: 'string',
            amount: 'number',
            customer_email: 'string',
            callback_url: 'string'
          },
          response: {
            authorization_url: 'string',
            access_code: 'string',
            reference: 'string'
          }
        },
        {
          method: 'POST',
          path: 'functions/paystack-webhook-secure',
          description: 'Handle payment webhooks (Paystack)',
          webhook: true,
          events: ['charge.success', 'charge.failed']
        },
        {
          method: 'GET',
          path: 'functions/paystack-verify/{reference}',
          description: 'Verify payment status',
          response: {
            status: 'string',
            verified: 'boolean',
            order_updated: 'boolean'
          }
        }
      ]
    }
  ];

  const emailTemplates = [
    {
      name: 'Order Confirmation',
      type: 'order_confirmation',
      trigger: 'Order placed and payment successful',
      subject: 'Order Confirmation - #{order_number}',
      description: 'Sent immediately after successful payment'
    },
    {
      name: 'Order Ready for Pickup',
      type: 'order_ready_pickup', 
      trigger: 'Order status changed to "ready"',
      subject: 'Your Order #{order_number} is Ready for Pickup!',
      description: 'Sent when order is prepared and ready for customer pickup'
    },
    {
      name: 'Order Shipped',
      type: 'order_shipped',
      trigger: 'Dispatch rider assigned',
      subject: 'Your Order #{order_number} is Out for Delivery',
      description: 'Sent when rider is assigned with tracking information'
    },
    {
      name: 'Order Completed',
      type: 'order_completed',
      trigger: 'Order status changed to "completed"',
      subject: 'Thank You for Your Order #{order_number}!',
      description: 'Thank you message after successful delivery/pickup'
    },
    {
      name: 'Order Status Update',
      type: 'order_status_update',
      trigger: 'Any status change',
      subject: 'Update on Your Order #{order_number}',
      description: 'General status update notifications'
    }
  ];

  const flowSteps = [
    {
      phase: 'Product Browsing',
      icon: <ShoppingCart className="w-5 h-5" />,
      steps: [
        'Customer views product catalog',
        'Add items to cart (guest or authenticated)',
        'Cart calculates totals with VAT and discounts'
      ]
    },
    {
      phase: 'Checkout',
      icon: <User className="w-5 h-5" />,
      steps: [
        'Choose: Guest Checkout or Login',
        'Select order type: Delivery or Pickup',
        'Enter customer details and address (if delivery)',
        'Review order summary and apply promotions'
      ]
    },
    {
      phase: 'Payment',
      icon: <CreditCard className="w-5 h-5" />,
      steps: [
        'Initialize payment with Paystack',
        'Customer completes payment',
        'Webhook verifies payment',
        'Order confirmation email sent'
      ]
    },
    {
      phase: 'Fulfillment',
      icon: <Package className="w-5 h-5" />,
      steps: [
        'Admin changes status to "preparing"',
        'Order prepared in kitchen/store',
        'Status updated to "ready" (pickup) or "out_for_delivery"',
        'Customer notified via email'
      ]
    },
    {
      phase: 'Completion',
      icon: <CheckSquare className="w-5 h-5" />,
      steps: [
        'Customer picks up or delivery completed',
        'Admin marks order as "completed"',
        'Thank you email sent',
        'Order archived'
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Buying Logic Implementation</h2>
        <p className="text-muted-foreground">
          Complete documentation for implementing the guest checkout and order management flow.
        </p>
      </div>

      <Tabs defaultValue="flow" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="flow">Process Flow</TabsTrigger>
          <TabsTrigger value="endpoints">API Endpoints</TabsTrigger>
          <TabsTrigger value="emails">Email Templates</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="flow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Complete Buying Process Flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {flowSteps.map((phase, index) => (
                  <div key={phase.phase} className="border-l-2 border-primary pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {phase.icon}
                      </div>
                      <h3 className="font-semibold text-lg">{phase.phase}</h3>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                      {phase.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          {endpoints.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.icon}
                  {category.category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.items.map((endpoint, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={endpoint.method === 'GET' ? 'secondary' : 
                                   endpoint.method === 'POST' ? 'default' : 
                                   endpoint.method === 'PUT' ? 'outline' : 'destructive'}>
                        {endpoint.method}
                      </Badge>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {endpoint.path}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(endpoint.path)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {endpoint.description}
                    </p>

                    {endpoint.auth && (
                      <div className="text-sm">
                        <strong>Auth:</strong> {endpoint.auth}
                      </div>
                    )}

                    {endpoint.trigger && (
                      <div className="text-sm">
                        <strong>Trigger:</strong> {endpoint.trigger}
                      </div>
                    )}

                    {endpoint.body && (
                      <details className="text-sm">
                        <summary className="font-medium cursor-pointer">Request Body</summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                          {JSON.stringify(endpoint.body, null, 2)}
                        </pre>
                      </details>
                    )}

                    {endpoint.response && (
                      <details className="text-sm">
                        <summary className="font-medium cursor-pointer">Response</summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                          {JSON.stringify(endpoint.response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Notification Templates</CardTitle>
              <p className="text-sm text-muted-foreground">
                Automated emails sent during the order lifecycle
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {emailTemplates.map((template) => (
                  <div key={template.type} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      <Badge variant="outline">{template.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {template.description}
                    </p>
                    <div className="space-y-1 text-sm">
                      <div><strong>Subject:</strong> {template.subject}</div>
                      <div><strong>Trigger:</strong> {template.trigger}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Testing Interface</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Test Order ID</label>
                  <Input
                    placeholder="Enter order ID to test"
                    value={testOrderId}
                    onChange={(e) => setTestOrderId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Test Email</label>
                  <Input
                    type="email"
                    placeholder="Enter email for testing"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => toast.info('Test order tracking functionality')}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Test Order Tracking
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => toast.info('Test email notification sending')}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Test Email Notifications
                </Button>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Quick Links</h4>
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => window.open('/orders', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Orders Dashboard
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => window.open('/settings?tab=communications', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Configure Email Settings
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => window.open('/settings?tab=payments', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Payment Configuration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};