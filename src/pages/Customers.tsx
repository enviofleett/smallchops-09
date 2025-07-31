
import React, { useState } from 'react';
import { Search, Filter, Plus, Edit, UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { CustomerAnalytics } from '@/components/customers/CustomerAnalytics';
import { CustomerFilters } from '@/components/customers/CustomerFilters';
import { CustomerTable } from '@/components/customers/CustomerTable';
import { CustomerTypeFilter, CustomerTypeFilter as CustomerTypeFilterType } from '@/components/customers/CustomerTypeFilter';
import { getCustomerAnalytics } from '@/api/customers';
import { DateRange, Customer, CustomerDb } from '@/types/customers';
import { CustomerDialog } from '@/components/customers/CustomerDialog';

const Customers = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date()
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilterType>('all');

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [currentEditCustomer, setCurrentEditCustomer] = useState<CustomerDb | null>(null);

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
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Customer Analytics</h1>
          <p className="text-gray-600 mt-2">Intelligent insights into your customer behavior</p>
        </div>
        <button
          className="mt-4 sm:mt-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg transition-all flex items-center space-x-2"
          onClick={openAddCustomer}
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Date Range Filters */}
      <CustomerFilters 
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Analytics Overview - cards are now clickable for all 5 types */}
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

      {/* --- REMOVE CHARTS SECTION
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analytics && (
          <>
            <TopCustomersChart 
              customers={analytics.topCustomersByOrders}
              type="orders"
              title="Top Customers by Orders"
            />
            <TopCustomersChart 
              customers={analytics.topCustomersBySpending}
              type="spending"
              title="Top Customers by Spending"
            />
          </>
        )}
      </div>
      --- */}

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
            <button className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 hover:bg-gray-100 transition-colors">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-gray-600">Filter</span>
            </button>
          </div>
        </div>

          <CustomerTable 
            customers={filteredCustomers}
            isLoading={isLoading}
            onEditCustomer={openEditCustomer}
            onCustomerDeleted={refetchAnalytics}
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

