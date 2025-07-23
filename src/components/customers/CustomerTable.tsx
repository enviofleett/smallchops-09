import React, { useState } from 'react';
import { Mail, Phone, Edit } from 'lucide-react';
import { Customer } from '@/types/customers';
import { CustomerDetailsModal } from './CustomerDetailsModal';

interface CustomerTableProps {
  customers: Customer[];
  isLoading?: boolean;
  onEditCustomer?: (customer: Customer) => void;
}

export const CustomerTable = ({ customers, isLoading, onEditCustomer }: CustomerTableProps) => {
  // Track selected customer for detailed modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
      'VIP': 'bg-purple-100 text-purple-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b border-gray-50 p-6">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-48"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Customer</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Contact</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Orders</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Total Spent</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Status</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Last Order</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-4">
                      <button
                        className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        aria-label={`View details for ${customer.name}`}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setDetailsOpen(true);
                        }}
                        tabIndex={0}
                        type="button"
                      >
                        {customer.name.charAt(0)}
                      </button>
                      <button
                        className="font-medium text-gray-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-300 text-left"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setDetailsOpen(true);
                        }}
                        type="button"
                        tabIndex={0}
                      >
                        {customer.name}
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-600">{customer.email}</span>
                      </div>
                      {customer.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-600">{customer.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-600">{customer.totalOrders}</td>
                  <td className="py-4 px-6 font-medium text-gray-800">
                    ₦{customer.totalSpent.toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(customer.status)}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-600">
                    {new Date(customer.lastOrderDate).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6">
                    {/* Edit button */}
                    {onEditCustomer && (
                      <button
                        className="p-2 rounded-md hover:bg-accent"
                        aria-label="Edit customer"
                        onClick={() => onEditCustomer(customer)}
                        type="button"
                      >
                        <Edit className="h-4 w-4 text-gray-700" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <CustomerDetailsModal
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
      />
    </>
  );
};
