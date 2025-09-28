import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import OrderDetailsSingleColumn from '@/components/orders/OrderDetailsSingleColumn';
import { useAuth } from '@/contexts/AuthContext';

export default function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();

  if (!orderId) {
    return <Navigate to="/admin/orders" replace />;
  }

  if (!user) {
    return <Navigate to="/admin/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <OrderDetailsSingleColumn 
          orderId={orderId} 
          adminEmail={user.email || 'admin@starterssmallchops.com'} 
        />
      </div>
    </div>
  );
}