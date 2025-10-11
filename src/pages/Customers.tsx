
import React, { useState } from 'react';
import { Search, Filter, Plus, Edit, UserPlus, Users, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { CustomerAnalytics } from '@/components/customers/CustomerAnalytics';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerTypeFilter, CustomerTypeFilter as CustomerTypeFilterType } from '@/components/customers/CustomerTypeFilter';
import { CustomerRateLimitWarning } from '@/components/customers/CustomerRateLimitWarning';
import { useIsMobile } from '@/hooks/use-mobile';


import { getCustomerAnalytics } from '@/api/customers';
import { DateRange, Customer, CustomerDb } from '@/types/customers';
import { CustomerDialog } from '@/components/customers/CustomerDialog';
import { Button } from '@/components/ui/button';

import { useCustomerRateLimit } from '@/hooks/useCustomerRateLimit';

const Customers = () => {
  const isMobile = useIsMobile();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilterType>('all');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [currentEditCustomer, setCurrentEditCustomer] = useState<CustomerDb | null>(null);
  

  // Rate limiting for customer operations
  const rateLimitStatus = useCustomerRateLimit('create', 50);

  // PRODUCTION-READY: Fetch customer analytics from secure DB functions
  // Data is filtered by date range and only includes paid orders
  const { data: analytics, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-analytics', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => getCustomerAnalytics(dateRange),
    retry: 3, // Retry failed requests up to 3 times
    staleTime: 2 * 60 * 1000, // 2 minutes cache for live data
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchInterval: false // No auto-refresh to avoid rate limits
  });

  // PRODUCTION-READY: Data validation with comprehensive null safety
  const allCustomers = Array.isArray(analytics?.allCustomers) ? analytics.allCustomers : [];
  const repeatCustomers = Array.isArray(analytics?.repeatCustomers) ? analytics.repeatCustomers : [];
  const hasValidAnalytics = analytics && typeof analytics.metrics === 'object';
  
  // Verify data source integrity (only paid customers should be shown)
  const verifiedCustomers = allCustomers.filter(c => 
    c.email && // Must have email
    c.name && // Must have name
    c.totalOrders >= 0 && // Valid order count
    c.totalSpent >= 0 // Valid spending amount
  );

  // Log errors for production monitoring
  if (error) {
    console.error('Customer analytics error:', error);
  }

  // PRODUCTION-READY: Filter with verified data
  const filteredCustomers = verifiedCustomers.filter((customer) => {
    // Search term filter with null safety
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (customer.name || '').toLowerCase().includes(searchLower) ||
      (customer.email || '').toLowerCase().includes(searchLower) ||
      (customer.phone || '').toLowerCase().includes(searchLower);
    
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
    <div className="space-y-6 md:space-y-8">
      {/* Page Header - Refined Typography & Layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
              <Users className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
                Customer Management
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1 leading-relaxed">
                Track, analyze, and engage with your customer base
              </p>
            </div>
          </div>
        </div>
        
        <Button
          size={isMobile ? "default" : "lg"}
          className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-300 gap-2"
          onClick={openAddCustomer}
          disabled={!rateLimitStatus.isAllowed || rateLimitStatus.isChecking}
        >
          <UserPlus className="h-4 w-4 md:h-5 md:w-5" />
          <span className="font-semibold">Add New Customer</span>
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
      
      {/* PRODUCTION: Analytics Overview - All data from paid orders only */}
      {analytics && (
        <CustomerAnalytics
          metrics={analytics.metrics}
          topCustomersByOrders={analytics.topCustomersByOrders}
          topCustomersBySpending={analytics.topCustomersBySpending}
          repeatCustomers={analytics.repeatCustomers}
          allCustomers={verifiedCustomers}
          isLoading={isLoading}
          dateRange={dateRange}
        />
      )}


      {/* Customer Type Filter - Production Ready */}
      {hasValidAnalytics && (
        <CustomerTypeFilter
          currentFilter={customerTypeFilter}
          onFilterChange={setCustomerTypeFilter}
          isLoading={isLoading}
          counts={{
            all: verifiedCustomers.length,
            authenticated: Math.max(0, analytics.metrics.authenticatedCustomers || 0),
            guest: Math.max(0, analytics.metrics.guestCustomers || 0)
          }}
        />
      )}

      {/* Search and Customer Table - Refined Design */}
      <div className="bg-gradient-to-br from-white to-muted/20 rounded-2xl shadow-lg border border-border/50 p-5 md:p-7">
        <div className="flex flex-col gap-5 mb-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                <Users className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
                  Customer Directory
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {filteredCustomers.length} of {verifiedCustomers.length} customers • Live production data
                </p>
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 md:h-5 md:w-5" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 md:pl-12 pr-4 py-3 md:py-3.5 text-sm md:text-base bg-background border-2 border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 placeholder:text-muted-foreground/60"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-lg">×</span>
              </button>
            )}
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

