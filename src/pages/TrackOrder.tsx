import React from 'react';
import { Helmet } from 'react-helmet-async';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { GuestOrderTracker } from '@/components/guest/GuestOrderTracker';
import { ProductionTrackingWrapper } from '@/components/tracking/ProductionTrackingWrapper';

export default function TrackOrder() {
  return (
    <ProductionTrackingWrapper>
      <Helmet>
        <title>Track Your Order - Real-time Delivery Updates</title>
        <meta name="description" content="Track your order in real-time. Get live updates on your delivery status, estimated arrival time, and rider information." />
        <meta name="keywords" content="order tracking, delivery status, real-time updates, order status, guest tracking" />
        <link rel="canonical" href="/track-order" />
      </Helmet>

      <PublicHeader />
      
      <main className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Track Your Order</h1>
            <p className="text-muted-foreground">
              Get real-time delivery updates for your order, whether you're a guest or registered user
            </p>
          </div>

          <GuestOrderTracker />
        </div>
      </main>
    </ProductionTrackingWrapper>
  );
}