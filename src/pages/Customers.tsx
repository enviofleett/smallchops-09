
import React, { useState } from 'react';
import { Search, Filter, Plus, Edit, UserPlus, Users, BarChart3, Trophy } from 'lucide-react';
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

      {/* Repeat Business Analysis - Refined Design */}
      {analytics && analytics.repeatCustomers.length > 0 && (
        <div className="bg-gradient-to-br from-white to-muted/30 rounded-2xl shadow-lg border border-border/50 p-5 md:p-7 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Trophy className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
                  Repeat Business Champions
                </h3>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Top customers driving recurring revenue • Live data
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                ✓ Verified Payments
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {analytics.repeatCustomers.slice(0, 3).map((customer, index) => {
              const safeCustomer = {
                id: customer.id || `repeat-${index}`,
                name: customer.name || 'Unknown Customer',
                totalOrders: Math.max(0, customer.totalOrders || 0),
                totalSpent: Math.max(0, customer.totalSpent || 0),
                isGuest: Boolean(customer.isGuest)
              };

              const avgOrderValue = safeCustomer.totalOrders > 0 
                ? Math.round(safeCustomer.totalSpent / safeCustomer.totalOrders)
                : 0;

              return (
                <div 
                  key={safeCustomer.id} 
                  className="group relative bg-white rounded-xl border border-border p-5 hover:shadow-xl hover:border-primary/50 transition-all duration-300"
                >
                  {/* Rank Badge */}
                  <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">#{index + 1}</span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Customer Name & Type */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-base text-foreground leading-tight line-clamp-2 flex-1" title={safeCustomer.name}>
                        {safeCustomer.name}
                      </h4>
                      {safeCustomer.isGuest && (
                        <span className="text-[10px] font-medium bg-orange-100 text-orange-700 px-2 py-1 rounded-md border border-orange-200 shrink-0">
                          Guest
                        </span>
                      )}
                    </div>
                    
                    {/* Metrics */}
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                        <span className="text-muted-foreground font-medium">Orders</span>
                        <span className="font-bold text-foreground">{safeCustomer.totalOrders}</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                        <span className="text-emerald-700 font-medium">Total Paid</span>
                        <span className="font-bold text-emerald-700">
                          ₦{safeCustomer.totalSpent.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                        <span className="text-blue-700 font-medium">Avg/Order</span>
                        <span className="font-bold text-blue-700">
                          ₦{avgOrderValue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No repeat customers state - Mobile Responsive */}
      {analytics && analytics.repeatCustomers.length === 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="text-center py-6 sm:py-8">
            <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4">
              <Users className="h-full w-full" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-2">No Repeat Customers Yet</h3>
            <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto px-4">
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

