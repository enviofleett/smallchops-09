import React from 'react';
import { Helmet } from 'react-helmet-async';
import { DeliveryScheduleDashboard } from '@/components/admin/delivery/DeliveryScheduleDashboard';

export default function AdminDelivery() {
  return (
    <>
      <Helmet>
        <title>Delivery Schedule - Admin Dashboard</title>
        <meta name="description" content="Manage delivery schedules, track orders with delivery times, and monitor delivery performance." />
      </Helmet>

      <DeliveryScheduleDashboard />
    </>
  );
}
