
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
  });

  // Get all customers (now includes customers without orders)
  const allCustomers = analytics?.allCustomers || [];

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

      {/* Repeat Business Analysis */}
      {analytics && analytics.repeatCustomers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Repeat Business Champions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics.repeatCustomers.slice(0, 3).map((customer, index) => (
              <div key={customer.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-800">{customer.name}</span>
                    {customer.isGuest && (
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
                  <div>{customer.totalOrders} orders</div>
                  <div>₦{customer.totalSpent.toLocaleString()} total</div>
                  <div className="text-xs text-gray-500">
                    Avg: ₦{Math.round(customer.totalSpent / customer.totalOrders).toLocaleString()} per order
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Type Filter */}
      {analytics && (
        <CustomerTypeFilter
          currentFilter={customerTypeFilter}
          onFilterChange={setCustomerTypeFilter}
          counts={{
            all: analytics.allCustomers.length,
            authenticated: analytics.metrics.authenticatedCustomers,
            guest: analytics.metrics.guestCustomers
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

