import React, { useState } from 'react';
import { Mail, Phone, Edit } from 'lucide-react';
import { Customer } from '@/types/customers';
import { CustomerDetailsModal } from './CustomerDetailsModal';
import { MobileTable, MobileRow, MobileField, MobileHeader, MobileHeaderCell, MobileBody } from '@/components/ui/mobile-table';

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
      <MobileTable>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-32 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-48"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </MobileTable>
    );
  }

  return (
    <>
      <MobileTable>
        <table className="w-full">
          <MobileHeader>
            <MobileHeaderCell>Customer</MobileHeaderCell>
            <MobileHeaderCell>Contact</MobileHeaderCell>
            <MobileHeaderCell>Orders</MobileHeaderCell>
            <MobileHeaderCell>Total Spent</MobileHeaderCell>
            <MobileHeaderCell>Status</MobileHeaderCell>
            <MobileHeaderCell>Last Order</MobileHeaderCell>
            <MobileHeaderCell>Actions</MobileHeaderCell>
          </MobileHeader>
          <MobileBody>
            {customers.map((customer) => (
              <MobileRow 
                key={customer.id} 
                onClick={() => {
                  setSelectedCustomer(customer);
                  setDetailsOpen(true);
                }}
              >
                <MobileField label="Customer">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-medium">
                      {customer.name.charAt(0)}
                    </div>
                    <span className="font-medium text-foreground">{customer.name}</span>
                  </div>
                </MobileField>
                
                <MobileField label="Contact">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{customer.email}</span>
                    </div>
                    {customer.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{customer.phone}</span>
                      </div>
                    )}
                  </div>
                </MobileField>
                
                <MobileField label="Orders">
                  <span className="text-muted-foreground">{customer.totalOrders}</span>
                </MobileField>
                
                <MobileField label="Total Spent">
                  <span className="font-medium text-foreground">
                    ₦{customer.totalSpent.toLocaleString()}
                  </span>
                </MobileField>
                
                <MobileField label="Status">
                  <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(customer.status)}`}>
                    {customer.status}
                  </span>
                </MobileField>
                
                <MobileField label="Last Order">
                  <span className="text-muted-foreground">
                    {new Date(customer.lastOrderDate).toLocaleDateString()}
                  </span>
                </MobileField>
                
                <MobileField label="Actions">
                  {onEditCustomer && (
                    <button
                      className="p-2 rounded-md hover:bg-accent"
                      aria-label="Edit customer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCustomer(customer);
                      }}
                      type="button"
                    >
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </MobileField>
              </MobileRow>
            ))}
          </MobileBody>
        </table>
      </MobileTable>
      
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
