import React from 'react';
import { Helmet } from 'react-helmet-async';
import ProductionOrderErrorBoundary from '@/components/admin/ProductionOrderErrorBoundary';
import { ProductionHealthDashboard } from '@/components/admin/ProductionHealthDashboard';
import { AdminOrdersContent } from '@/components/admin/orders/AdminOrdersContent';

function AdminOrdersWrapper() {
  return (
    <ProductionOrderErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Helmet>
          <title>Order Management - Starters Small Chops Admin</title>
          <meta name="description" content="Manage and track all customer orders efficiently" />
        </Helmet>
        
        <div className="container mx-auto px-4 py-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Order Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Track, manage, and process customer orders
              </p>
            </div>
            <ProductionHealthDashboard />
          </div>

          <AdminOrdersContent />
        </div>
      </div>
    </ProductionOrderErrorBoundary>
  );
}

export default AdminOrdersWrapper;