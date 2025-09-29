import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { NewOrderDetailsModal } from '@/components/orders/NewOrderDetailsModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { safeOrder } from '@/utils/orderDefensiveValidation';

export default function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!orderId) {
    return <Navigate to="/admin/orders" replace />;
  }

  if (!user) {
    return <Navigate to="/admin/auth" replace />;
  }

  // Fetch order data
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              *,
              product:products (
                id, name, description, price, cost_price, image_url, 
                category_id, features, ingredients
              )
            )
          `)
          .eq('id', orderId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          setError('Order not found');
          return;
        }

        // Normalize order items to ensure consistent .product field
        if (data.order_items) {
          data.order_items = data.order_items.map((item: any) => ({
            ...item,
            // Ensure .product is always present and consistent
            product: item.product || (Array.isArray(item.products) ? item.products[0] : item.products) || null
          }));
        }

        // Apply defensive validation to ensure robust data handling
        const validatedOrder = safeOrder({
          ...data,
          items: data.order_items || [],
          order_items: data.order_items || []
        });

        if (!validatedOrder) {
          setError('Invalid order data received');
          return;
        }

        setOrder(validatedOrder);
        setIsModalOpen(true);
      } catch (err) {
        console.error('Error fetching order:', err);
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleClose = () => {
    setIsModalOpen(false);
    // Navigate back to orders page when modal closes
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Unable to Load Order</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button 
              onClick={() => window.location.reload()}
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry Loading
            </button>
            <button 
              onClick={() => window.history.back()}
              className="block w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Order Details</h1>
          <p className="text-muted-foreground mb-4">Order ID: {orderId}</p>
        </div>
        <NewOrderDetailsModal 
          open={isModalOpen}
          onClose={handleClose}
          order={order}
        />
      </div>
    </div>
  );
}