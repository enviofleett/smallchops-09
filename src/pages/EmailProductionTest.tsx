import React from 'react';
import { EmailProductionDashboard } from '@/components/admin/EmailProductionDashboard';
import { PaystackProductionHealthDashboard } from '@/components/admin/PaystackProductionHealthDashboard';
import { ProductionEmailStatus } from '@/components/admin/ProductionEmailStatus';
import { GmailSMTPTester } from '@/components/admin/GmailSMTPTester';

export const EmailProductionTest: React.FC = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Gmail SMTP Production Testing</h1>
        <p className="text-muted-foreground">
          Test and validate your Gmail SMTP configuration with App Password authentication
        </p>
      </div>
      
      <GmailSMTPTester />
      <ProductionEmailStatus />
      <PaystackProductionHealthDashboard />
      <EmailProductionDashboard />
    </div>
  );
};