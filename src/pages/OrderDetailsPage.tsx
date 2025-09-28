import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { NewOrderDetailsModal } from '@/components/orders/NewOrderDetailsModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

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
              products (
                id, name, description, price, image_url
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

        setOrder(data);
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
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.history.back()}
            className="text-blue-600 hover:underline"
          >
            Go back
          </button>
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