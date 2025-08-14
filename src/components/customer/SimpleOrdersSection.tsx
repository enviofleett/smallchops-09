import React from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Clock, CheckCircle } from 'lucide-react';

export const SimpleOrdersSection = () => {
  const { user, customerAccount } = useCustomerAuth();

  // Mock orders data for now - replace with actual API call
  const mockOrders = [
    {
      id: '1',
      order_number: 'ORD-001',
      status: 'preparing',
      total_amount: 2500,
      created_at: new Date().toISOString(),
      items: ['Budget Baller', 'Small Chops']
    },
    {
      id: '2', 
      order_number: 'ORD-002',
      status: 'delivered',
      total_amount: 1800,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      items: ['Party Pack']
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'preparing':
        return <Clock className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My Orders</h2>
        <p className="text-gray-600">Track your recent orders and purchase history</p>
      </div>

      <div className="space-y-4">
        {mockOrders.map((order) => (
          <Card key={order.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">Order #{order.order_number}</h3>
                <p className="text-sm text-gray-500">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge className={`px-3 py-1 ${getStatusColor(order.status)}`}>
                <div className="flex items-center gap-1">
                  {getStatusIcon(order.status)}
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </div>
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-sm">
                <strong>Items:</strong> {order.items.join(', ')}
              </p>
              <p className="text-sm">
                <strong>Total:</strong> ₦{order.total_amount.toLocaleString()}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                View Details
              </Button>
              {order.status !== 'delivered' && (
                <Button variant="ghost" size="sm">
                  Track Order
                </Button>
              )}
            </div>
          </Card>
        ))}

        {mockOrders.length === 0 && (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-gray-500 mb-4">
              Start shopping to see your orders here
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Browse Menu
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SimpleOrdersSection;