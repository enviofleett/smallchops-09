import React from 'react';
import { EmailProductionDashboard } from '@/components/admin/EmailProductionDashboard';
import { PaystackProductionHealthDashboard } from '@/components/admin/PaystackProductionHealthDashboard';
import { ProductionEmailStatus } from '@/components/admin/ProductionEmailStatus';

export const EmailProductionTest: React.FC = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <ProductionEmailStatus />
      <PaystackProductionHealthDashboard />
      <EmailProductionDashboard />
    </div>
  );
};