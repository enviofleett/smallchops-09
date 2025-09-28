import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrderDetailsSingleColumn from '@/components/orders/OrderDetailsSingleColumn';

interface OrderDetailsPageProps {
  adminEmail?: string;
}

/**
 * Order Details Page - Demo page showing how to use the OrderDetailsSingleColumn component
 * 
 * Usage:
 * - Route: /admin/orders/:orderId
 * - Displays full order details in single column layout
 * - Includes admin actions for status updates and rider assignments
 * - Shows success/error notifications for all actions
 */
const OrderDetailsPage: React.FC<OrderDetailsPageProps> = ({ 
  adminEmail = 'admin@starterssmallchops.com' 
}) => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  if (!orderId) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invalid Order ID</h1>
          <p className="text-muted-foreground mt-2">
            Please provide a valid order ID to view details.
          </p>
          <Button onClick={() => navigate('/admin/orders')} className="mt-4">
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Navigation */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/orders')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Orders
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold">Order Details</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-6">
        <OrderDetailsSingleColumn 
          orderId={orderId} 
          adminEmail={adminEmail}
        />
      </div>
    </div>
  );
};

export default OrderDetailsPage;