import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { NewOrderDetailsModal } from '@/components/orders/NewOrderDetailsModal';
import { useAuth } from '@/contexts/AuthContext';

export default function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!orderId) {
    return <Navigate to="/admin/orders" replace />;
  }

  if (!user) {
    return <Navigate to="/admin/auth" replace />;
  }

  // Auto-open the modal when the page loads
  useEffect(() => {
    setIsModalOpen(true);
  }, []);

  const handleClose = () => {
    setIsModalOpen(false);
    // Navigate back to orders page when modal closes
    window.history.back();
  };

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
          order={null} // Will use mock data
        />
      </div>
    </div>
  );
}