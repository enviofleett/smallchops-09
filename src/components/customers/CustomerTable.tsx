import React, { useState } from 'react';
import { Mail, Phone, Edit, Trash2 } from 'lucide-react';
import { Customer } from '@/types/customers';
import { CustomerDetailsModal } from './CustomerDetailsModal';
import { EmailStatusBadge } from './EmailStatusBadge';
import { EmailActions } from './EmailActions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { deleteCustomer } from "@/api/customers";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow, MobileCardActions } from '@/components/ui/responsive-table';
import { Button } from '@/components/ui/button';

interface CustomerTableProps {
  customers: Customer[];
  isLoading?: boolean;
  onEditCustomer?: (customer: Customer) => void;
  onCustomerDeleted?: () => void;
  onEmailResent?: () => void;
}

export const CustomerTable = ({ customers, isLoading, onEditCustomer, onCustomerDeleted, onEmailResent }: CustomerTableProps) => {
  // Track selected customer for detailed modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const { toast } = useToast();

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
      'VIP': 'bg-purple-100 text-purple-800',
      'Registered': 'bg-blue-100 text-blue-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const handleDeleteCustomer = async (customerId: string, customerName: string) => {
    try {
      setDeletingCustomerId(customerId);
      await deleteCustomer(customerId);
      
      toast({
        title: "Customer Deleted",
        description: `${customerName} has been successfully deleted.`,
      });
      
      onCustomerDeleted?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingCustomerId(null);
    }
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

  const mobileComponent = (
    <div className="space-y-3">
      {customers.map((customer) => (
        <MobileCard 
          key={customer.id}
          onClick={() => {
            setSelectedCustomer(customer);
            setDetailsOpen(true);
          }}
        >
          <MobileCardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                {customer.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-800">{customer.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{customer.email}</span>
                  {customer.isGuest && (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                      Guest
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(customer.status)}`}>
              {customer.status}
            </span>
          </MobileCardHeader>
          
          <MobileCardContent>
            {customer.phone && (
              <MobileCardRow 
                label="Phone" 
                value={customer.phone} 
              />
            )}
            <MobileCardRow 
              label="Orders" 
              value={customer.totalOrders} 
            />
            <MobileCardRow 
              label="Total Spent" 
              value={<span className="font-semibold">₦{customer.totalSpent.toLocaleString()}</span>} 
            />
            <MobileCardRow 
              label="Last Activity" 
              value={customer.totalOrders > 0 
                ? new Date(customer.lastOrderDate).toLocaleDateString()
                : customer.isGuest 
                  ? 'No orders yet'
                  : `Registered ${new Date(customer.lastOrderDate).toLocaleDateString()}`
              } 
            />
            <MobileCardRow 
              label="Email Status" 
              value={
                <div className="flex items-center gap-2">
                  <EmailStatusBadge 
                    status={customer.emailStatus || 'none'}
                    sentAt={customer.emailSentAt}
                    lastAttempt={customer.emailLastAttempt}
                  />
                  <EmailActions
                    customerEmail={customer.email}
                    customerName={customer.name}
                    emailStatus={customer.emailStatus || 'none'}
                    onEmailResent={onEmailResent}
                  />
                </div>
              } 
            />
          </MobileCardContent>
          
          <MobileCardActions>
            {onEditCustomer && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCustomer(customer);
                }}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  disabled={deletingCustomerId === customer.id}
                  className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete <strong>{customer.name}</strong>? 
                    This will permanently remove the customer and all their related data including orders, favorites, and reviews. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Customer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </MobileCardActions>
        </MobileCard>
      ))}
    </div>
  );

  return (
    <>
      <ResponsiveTable
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        mobileComponent={mobileComponent}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Customer</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Contact</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Orders</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Total Spent</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Status</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Email Status</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Last Activity</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Actions</th>
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
                      <div>
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
                        {customer.isGuest && (
                          <span className="ml-2 inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                            Guest
                          </span>
                        )}
                      </div>
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
                   <td className="py-4 px-6">
                     <div className="flex items-center gap-2">
                       <EmailStatusBadge 
                         status={customer.emailStatus || 'none'}
                         sentAt={customer.emailSentAt}
                         lastAttempt={customer.emailLastAttempt}
                       />
                       <EmailActions
                         customerEmail={customer.email}
                         customerName={customer.name}
                         emailStatus={customer.emailStatus || 'none'}
                         onEmailResent={onEmailResent}
                       />
                     </div>
                   </td>
                    <td className="py-4 px-6 text-gray-600">
                      {customer.totalOrders > 0 
                        ? new Date(customer.lastOrderDate).toLocaleDateString()
                        : customer.isGuest 
                          ? 'No orders yet'
                          : `Registered ${new Date(customer.lastOrderDate).toLocaleDateString()}`
                      }
                    </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
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
                      
                      {/* Delete button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="p-2 rounded-md hover:bg-red-50 text-red-600 hover:text-red-700"
                            aria-label="Delete customer"
                            disabled={deletingCustomerId === customer.id}
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete <strong>{customer.name}</strong>? 
                              This will permanently remove the customer and all their related data including orders, favorites, and reviews. 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Customer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ResponsiveTable>
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