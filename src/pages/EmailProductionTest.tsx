import React from 'react';
import { EmailProductionDashboard } from '@/components/admin/EmailProductionDashboard';
import { PaystackProductionHealthDashboard } from '@/components/admin/PaystackProductionHealthDashboard';
import { ProductionEmailStatus } from '@/components/admin/ProductionEmailStatus';
import { EmailSystemTester } from '@/components/admin/EmailSystemTester';

export const EmailProductionTest: React.FC = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Email Production Test Suite</h1>
      <ProductionEmailStatus />
      <EmailSystemTester />
      <PaystackProductionHealthDashboard />
      <EmailProductionDashboard />
    </div>
  );
};