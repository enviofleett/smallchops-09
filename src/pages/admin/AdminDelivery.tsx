import React from 'react';
import { Helmet } from 'react-helmet-async';
import { DeliveryScheduleDashboard } from '@/components/admin/delivery/DeliveryScheduleDashboard';

export default function AdminDelivery() {
  return (
    <>
      <Helmet>
        <title>Ready Orders - Delivery Management</title>
        <meta name="description" content="Manage ready orders for delivery dispatch, assign drivers, and track delivery performance." />
      </Helmet>

      <DeliveryScheduleDashboard />
    </>
  );
}
