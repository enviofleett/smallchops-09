
import React from 'react';
import { EmailManagement } from '@/components/admin/EmailManagement';
import AdminPageWrapper from '@/components/admin/AdminPageWrapper';

const AdminEmailSettings = () => {
  return (
    <AdminPageWrapper
      title="Email Management"
      description="Monitor and manage your email system with production-ready tools"
      menuPermission="settingsCommunications"
      permissionLevel="edit"
      requiredRole="admin"
    >
      <EmailManagement />
    </AdminPageWrapper>
  );
};

export default AdminEmailSettings;
