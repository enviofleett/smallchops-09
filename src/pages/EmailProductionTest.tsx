import React from 'react';
import { EmailProductionDashboard } from '@/components/admin/EmailProductionDashboard';
import { PaystackProductionHealthDashboard } from '@/components/admin/PaystackProductionHealthDashboard';
import { ProductionEmailStatus } from '@/components/admin/ProductionEmailStatus';
import { EmailSystemTester } from '@/components/admin/EmailSystemTester';
import { SMTPHealthMonitor } from '@/components/admin/SMTPHealthMonitor';
import { EmailQueueStatus } from '@/components/admin/EmailQueueStatus';

export const EmailProductionTest: React.FC = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Email Production Test Suite</h1>
      
      {/* SMTP Health and Queue Status - Priority Issues */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SMTPHealthMonitor />
        <EmailQueueStatus />
      </div>
      
      {/* Existing Components */}
      <ProductionEmailStatus />
      <EmailSystemTester />
      <PaystackProductionHealthDashboard />
      <EmailProductionDashboard />
    </div>
  );
};