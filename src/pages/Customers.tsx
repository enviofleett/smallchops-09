
import React, { useState } from 'react';
import { Search, Filter, Plus, Edit, UserPlus, Shield, Users, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { CustomerAnalytics } from '@/components/customers/CustomerAnalytics';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerTypeFilter, CustomerTypeFilter as CustomerTypeFilterType } from '@/components/customers/CustomerTypeFilter';
import { CustomerRateLimitWarning } from '@/components/customers/CustomerRateLimitWarning';
import { CustomerSecurityDashboard } from '@/components/customers/CustomerSecurityDashboard';
import { BulkEmailActions } from '@/components/customers/BulkEmailActions';
import { getCustomerAnalytics } from '@/api/customers';
import { DateRange, Customer, CustomerDb } from '@/types/customers';
import { CustomerDialog } from '@/components/customers/CustomerDialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCustomerRateLimit } from '@/hooks/useCustomerRateLimit';

const Customers = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilterType>('all');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [currentEditCustomer, setCurrentEditCustomer] = useState<CustomerDb | null>(null);
  const [securitySectionOpen, setSecuritySectionOpen] = useState(false);

  // Rate limiting for customer operations
  const rateLimitStatus = useCustomerRateLimit('create', 50);

  const { data: analytics, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-analytics', dateRange],
    queryFn: () => getCustomerAnalytics(dateRange),
    retry: 3, // Retry failed requests up to 3 times
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false // Prevent unnecessary refetches
  });

  // Production-ready data validation and fallbacks
  const allCustomers = Array.isArray(analytics?.allCustomers) ? analytics.allCustomers : [];
  const repeatCustomers = Array.isArray(analytics?.repeatCustomers) ? analytics.repeatCustomers : [];
  const hasValidAnalytics = analytics && typeof analytics.metrics === 'object';

  // Log errors for production monitoring
  if (error) {
    console.error('Customer analytics error:', error);
  }

  const filteredCustomers = allCustomers.filter((customer) => {
    // Search term filter
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.phone && customer.phone.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Customer type filter
    const matchesType = customerTypeFilter === 'all' || 
      (customerTypeFilter === 'guest' && customer.isGuest) ||
      (customerTypeFilter === 'authenticated' && !customer.isGuest);
    
    return matchesSearch && matchesType;
  });

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-red-600">Error loading customer analytics: {error.message}</p>
        </div>
      </div>
    );
  }

  const openAddCustomer = () => {
    // Check rate limit before allowing new customer creation
    if (!rateLimitStatus.isAllowed) {
      return; // Rate limit warning will be shown in UI
    }
    setCurrentEditCustomer(null);
    setCustomerDialogOpen(true);
  };
  
  const openEditCustomer = (customer: Customer) => {
    setCurrentEditCustomer({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      created_at: "",
      updated_at: ""
    });
    setCustomerDialogOpen(true);
  };

  const refetchAnalytics = () => {
    // Refetch the analytics data
    refetch();
    rateLimitStatus.checkRateLimit(); // Also refresh rate limit status
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Customer Management</h1>
          <p className="text-gray-600 mt-2">Comprehensive customer management with security controls</p>
        </div>
        <Button
          className="mt-4 sm:mt-0 flex items-center space-x-2"
          onClick={openAddCustomer}
          disabled={!rateLimitStatus.isAllowed || rateLimitStatus.isChecking}
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Customer</span>
        </Button>
      </div>

      {/* Date Range Filters */}
      <CustomerFilters 
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Rate Limit Warning */}
      <CustomerRateLimitWarning
        remainingActions={rateLimitStatus.remainingActions}
        resetTime={rateLimitStatus.resetTime}
        isAllowed={rateLimitStatus.isAllowed}
        onRefresh={rateLimitStatus.checkRateLimit}
      />
      {/* Analytics Overview */}
      {analytics && (
        <CustomerAnalytics
          metrics={analytics.metrics}
          topCustomersByOrders={analytics.topCustomersByOrders}
          topCustomersBySpending={analytics.topCustomersBySpending}
          repeatCustomers={analytics.repeatCustomers}
          allCustomers={allCustomers}
          isLoading={isLoading}
        />
      )}

      {/* Repeat Business Analysis - Production Ready with Paid Orders Only */}
      {analytics && analytics.repeatCustomers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Repeat Business Champions</h3>
              <p className="text-sm text-gray-500 mt-1">Based on paid orders only • Updated in real-time</p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">✓ Paid Only</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics.repeatCustomers.slice(0, 3).map((customer, index) => {
              // Production-ready validation and safety checks
              const safeCustomer = {
                id: customer.id || `repeat-${index}`,
                name: customer.name || 'Unknown Customer',
                totalOrders: Math.max(0, customer.totalOrders || 0),
                totalSpent: Math.max(0, customer.totalSpent || 0),
                isGuest: Boolean(customer.isGuest)
              };

              // Calculate average order value safely
              const avgOrderValue = safeCustomer.totalOrders > 0 
                ? Math.round(safeCustomer.totalSpent / safeCustomer.totalOrders)
                : 0;

              return (
                <div key={safeCustomer.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-800 truncate" title={safeCustomer.name}>
                        {safeCustomer.name.length > 20 
                          ? `${safeCustomer.name.substring(0, 20)}...` 
                          : safeCustomer.name
                        }
                      </span>
                      {safeCustomer.isGuest && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                          Guest
                        </span>
                      )}
                    </div>
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                      #{index + 1}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Orders:</span>
                      <span className="font-semibold">{safeCustomer.totalOrders}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Paid:</span>
                      <span className="font-semibold text-green-600">₦{safeCustomer.totalSpent.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-500 pt-1 border-t">
                      <div className="flex items-center justify-between">
                        <span>Avg per order:</span>
                        <span>₦{avgOrderValue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Production footer with data integrity info */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing top {Math.min(3, analytics.repeatCustomers.length)} of {analytics.repeatCustomers.length} repeat customers
              </span>
              <span>
                Last updated: {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No repeat customers state - Production ready */}
      {analytics && analytics.repeatCustomers.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <Users className="h-full w-full" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">No Repeat Customers Yet</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Once customers make multiple paid orders, they'll appear here as your repeat business champions.
            </p>
            <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 max-w-md mx-auto">
              <strong>Note:</strong> Only customers with paid orders are counted for accurate business metrics.
            </div>
          </div>
        </div>
      )}

      {/* Customer Type Filter - Production Ready */}
      {hasValidAnalytics && (
        <CustomerTypeFilter
          currentFilter={customerTypeFilter}
          onFilterChange={setCustomerTypeFilter}
          isLoading={isLoading}
          counts={{
            all: allCustomers.length,
            authenticated: Math.max(0, analytics.metrics.authenticatedCustomers || 0),
            guest: Math.max(0, analytics.metrics.guestCustomers || 0)
          }}
        />
      )}

      {/* Search and Customer Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-6">
          <h3 className="text-lg font-semibold text-gray-800">All Customers</h3>
          
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <BulkEmailActions onEmailsRequeued={refetchAnalytics} />
            <Button 
              variant="outline"
              className="flex items-center space-x-2"
              onClick={openAddCustomer}
              disabled={!rateLimitStatus.isAllowed || rateLimitStatus.isChecking}
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Customer</span>
            </Button>
          </div>
        </div>

        <CustomerTable 
          customers={filteredCustomers}
          isLoading={isLoading}
          onEditCustomer={openEditCustomer}
          onCustomerDeleted={refetchAnalytics}
          onEmailResent={refetchAnalytics}
        />
      </div>

      {/* Collapsible Security Section */}
      <Collapsible open={securitySectionOpen} onOpenChange={setSecuritySectionOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security & Audit Dashboard
            </div>
            <Filter className={`h-4 w-4 transition-transform ${securitySectionOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 mt-6">
          <CustomerSecurityDashboard />
        </CollapsibleContent>
      </Collapsible>
      
      <CustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        onSave={refetchAnalytics}
        initialCustomer={currentEditCustomer}
      />
    </div>
  );
};

export default Customers;

