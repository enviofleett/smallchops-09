import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { OrderStatus } from '@/types/orders';
import { useOrdersSmart } from '@/hooks/useOrdersFallback';
import { useOrdersRealTime } from '@/hooks/useOrdersNew';
import { OrdersList } from './OrdersList';
import { OrderFilters } from './OrderFilters';
import { OrderStats } from './OrderStats';
import { ConflictDialog } from './ConflictDialog';
import { EmailQueueStatus } from './EmailQueueStatus';
import { DataSourceIndicator } from './DataSourceIndicator';
import { Separator } from "@/components/ui/separator";

interface ConflictInfo {
  orderId: string;
  currentVersion: number;
  currentStatus: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  attemptedStatus: string;
}

export function OrdersPageNew() {
  const [filters, setFilters] = useState<{
    status: OrderStatus | 'all';
    search: string;
    page: number;
    pageSize: number;
  }>({
    status: 'all',
    search: '',
    page: 1,
    pageSize: 20
  });
  
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  
  // Data fetching with smart fallback
  const { data: ordersData, isLoading, error, refetch } = useOrdersSmart(filters);
  
  // Real-time updates
  const { subscribe } = useOrdersRealTime();
  
  useEffect(() => {
    const unsubscribe = subscribe();
    return unsubscribe;
  }, [subscribe]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  // Handle conflicts
  const handleConflict = (conflict: ConflictInfo) => {
    setConflictInfo(conflict);
  };

  const handleConflictResolution = (action: 'accept' | 'override' | 'cancel') => {
    if (action === 'accept') {
      // Refresh data to show current state
      refetch();
    } else if (action === 'override') {
      // Force update with current version
      // This would be handled by the OrdersList component
    }
    setConflictInfo(null);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive mb-4">Error Loading Orders</h1>
            <p className="text-muted-foreground mb-4">{error.message}</p>
            <button 
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Helmet>
        <title>Order Management - Starters Small Chops Admin</title>
        <meta name="description" content="Manage and track all customer orders efficiently" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Email Queue Status */}
        <EmailQueueStatus />
        
        <Separator />
        
        {/* Header with Data Source Indicator */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Order Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Track, manage, and process customer orders with reliable email notifications
            </p>
          </div>
          <DataSourceIndicator 
            source={ordersData?.source}
            isLoading={isLoading}
            error={error}
            ordersCount={ordersData?.orders?.length || ordersData?.total_count}
          />
        </div>

        {/* Stats */}
        <OrderStats orders={ordersData?.orders || []} />

        {/* Filters */}
        <OrderFilters 
          filters={filters}
          onFilterChange={handleFilterChange}
          onRefresh={() => refetch()}
        />

        {/* Orders List */}
        <OrdersList
          orders={ordersData?.orders || []}
          isLoading={isLoading}
          currentPage={filters.page}
          totalPages={Math.ceil((ordersData?.total_count || 0) / filters.pageSize)}
          onPageChange={handlePageChange}
          onConflict={handleConflict}
        />

        {/* Conflict Resolution Dialog */}
        {conflictInfo && (
          <ConflictDialog
            conflictInfo={conflictInfo}
            onResolve={handleConflictResolution}
          />
        )}
      </div>
    </div>
  );
}