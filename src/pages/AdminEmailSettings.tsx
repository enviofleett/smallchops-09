
import React from 'react';
import { EmailManagement } from '@/components/admin/EmailManagement';

const AdminEmailSettings = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Email Management</h1>
        <p className="text-gray-600 mt-2">
          Monitor and manage your email system with production-ready tools
        </p>
      </div>
      
      <EmailManagement />
    </div>
  );
};

export default AdminEmailSettings;
