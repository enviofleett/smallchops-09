
import React from 'react';
import { EmailTemplateManager } from '@/components/admin/EmailTemplateManager';

const AdminEmailTemplates = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Email Templates</h1>
        <p className="text-muted-foreground">
          Manage email templates for automated communications. Create, edit, and test email templates.
        </p>
      </div>
      
      <div className="rounded-lg border border-border bg-card">
        <EmailTemplateManager />
      </div>
    </div>
  );
};

export default AdminEmailTemplates;
