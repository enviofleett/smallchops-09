import React from 'react';
import { EmailStatusMonitor } from '@/components/admin/email/EmailStatusMonitor';

export default function EmailMonitor() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Email System Monitor</h1>
      <EmailStatusMonitor />
    </div>
  );
}