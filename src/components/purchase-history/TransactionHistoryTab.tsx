import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calendar, ArrowUpDown } from 'lucide-react';
import { getCustomerTransactionHistory, PurchaseHistoryFilters, TransactionHistory } from '@/api/purchaseHistory';
import { useToast } from '@/hooks/use-toast';

interface TransactionHistoryTabProps {
  customerEmail: string;
}

export function TransactionHistoryTab({ customerEmail }: TransactionHistoryTabProps) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<PurchaseHistoryFilters>({
    page: 1,
    pageSize: 10
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const { transactions: fetchedTransactions, count } = await getCustomerTransactionHistory(customerEmail, filters);
        setTransactions(fetchedTransactions);
        setTotalCount(count);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        toast({
          title: "Error",
          description: "Failed to load transaction history",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [customerEmail, filters, toast]);

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'charge': return 'bg-green-100 text-green-800';
      case 'refund': return 'bg-blue-100 text-blue-800';
      case 'partial_refund': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTransactionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const totalPages = Math.ceil(totalCount / (filters.pageSize || 10));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Filter Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="date"
              placeholder="From Date"
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value, page: 1 })}
            />
            
            <Input
              type="date"
              placeholder="To Date"
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value, page: 1 })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Transactions Found</h3>
              <p className="text-muted-foreground">
                {filters.dateFrom || filters.dateTo 
                  ? 'No transactions match your date filters.' 
                  : 'You don\'t have any transaction history yet.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          transactions.map((transaction) => (
            <Card key={transaction.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">
                        {transaction.order?.order_number || 'N/A'}
                      </h3>
                      <Badge className={getTransactionTypeColor(transaction.transaction_type)}>
                        {formatTransactionType(transaction.transaction_type)}
                      </Badge>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {new Date(transaction.created_at).toLocaleDateString()} • 
                      {transaction.payment_method || 'Unknown Method'}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        transaction.transaction_type === 'charge' 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {transaction.transaction_type === 'charge' ? '-' : '+'}
                        ${transaction.amount} {transaction.currency}
                      </span>
                    </div>
                    
                    {transaction.provider_transaction_id && (
                      <p className="text-xs text-muted-foreground">
                        Transaction ID: {transaction.provider_transaction_id}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    {transaction.processed_at && (
                      <p className="text-sm text-muted-foreground">
                        Processed: {new Date(transaction.processed_at).toLocaleDateString()}
                      </p>
                    )}
                    
                    {transaction.order && (
                      <p className="text-sm font-medium">
                        Order Total: ${transaction.order.total_amount}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((filters.page || 1) - 1) * (filters.pageSize || 10) + 1} to{' '}
            {Math.min((filters.page || 1) * (filters.pageSize || 10), totalCount)} of {totalCount} transactions
          </p>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={(filters.page || 1) <= 1}
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
            >
              Previous
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              disabled={(filters.page || 1) >= totalPages}
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}