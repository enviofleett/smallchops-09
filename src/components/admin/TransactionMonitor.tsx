import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Search, Filter, Eye, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface Transaction {
  id: string;
  provider_reference: string;
  amount: number;
  currency: string;
  status: string;
  customer_email?: string;
  customer_phone?: string;
  payment_method?: string;
  channel?: string;
  gateway_response?: string;
  created_at: string;
  paid_at?: string;
  fees?: number;
}

interface RefundData {
  amount: number;
  reason: string;
}

export const TransactionMonitor: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [refundData, setRefundData] = useState<RefundData>({ amount: 0, reason: '' });
  const [refundLoading, setRefundLoading] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  
  const { toast } = useToast();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      handleError(error, 'loading transactions');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = !searchTerm || 
      transaction.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.provider_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    const matchesChannel = channelFilter === 'all' || transaction.channel === channelFilter;
    
    return matchesSearch && matchesStatus && matchesChannel;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRefund = async () => {
    if (!selectedTransaction) return;

    setRefundLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('refund-management', {
        body: {
          action: 'create_refund',
          transactionId: selectedTransaction.id,
          amount: refundData.amount,
          reason: refundData.reason
        }
      });

      if (error) throw error;

      if (data.status) {
        toast({
          title: "Success",
          description: "Refund initiated successfully",
        });
        setShowRefundDialog(false);
        setRefundData({ amount: 0, reason: '' });
        loadTransactions();
      } else {
        throw new Error(data.error || 'Failed to create refund');
      }
    } catch (error) {
      handleError(error, 'creating refund');
    } finally {
      setRefundLoading(false);
    }
  };

  const openRefundDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setRefundData({ amount: transaction.amount, reason: '' });
    setShowRefundDialog(true);
  };

  const uniqueChannels = [...new Set(transactions.map(t => t.channel).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Transaction Monitor</h2>
          <p className="text-muted-foreground">Real-time payment transaction monitoring</p>
        </div>
        <Button onClick={loadTransactions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{transactions.length}</p>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {transactions.filter(t => t.status === 'success').length}
              </p>
              <p className="text-sm text-muted-foreground">Successful</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {transactions.filter(t => t.status === 'failed').length}
              </p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatCurrency(
                  transactions
                    .filter(t => t.status === 'success')
                    .reduce((sum, t) => sum + t.amount, 0)
                )}
              </p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, reference, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {uniqueChannels.map(channel => (
                  <SelectItem key={channel} value={channel}>{channel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {transaction.provider_reference?.slice(0, 12)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{transaction.customer_email}</div>
                      {transaction.customer_phone && (
                        <div className="text-sm text-muted-foreground">
                          {transaction.customer_phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </div>
                    {transaction.fees > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Fee: {formatCurrency(transaction.fees, transaction.currency)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {transaction.channel || transaction.payment_method || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(transaction.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Transaction Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Reference</Label>
                                <p className="font-mono text-sm">{transaction.provider_reference}</p>
                              </div>
                              <div>
                                <Label>Status</Label>
                                <div className="mt-1">{getStatusBadge(transaction.status)}</div>
                              </div>
                              <div>
                                <Label>Amount</Label>
                                <p className="font-medium">{formatCurrency(transaction.amount, transaction.currency)}</p>
                              </div>
                              <div>
                                <Label>Channel</Label>
                                <p>{transaction.channel || 'N/A'}</p>
                              </div>
                              <div>
                                <Label>Gateway Response</Label>
                                <p className="text-sm">{transaction.gateway_response || 'N/A'}</p>
                              </div>
                              <div>
                                <Label>Date Created</Label>
                                <p className="text-sm">{formatDate(transaction.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      {transaction.status === 'success' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRefundDialog(transaction)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Transaction Reference</Label>
              <p className="font-mono text-sm">{selectedTransaction?.provider_reference}</p>
            </div>
            <div>
              <Label>Original Amount</Label>
              <p className="font-medium">
                {selectedTransaction && formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
              </p>
            </div>
            <div>
              <Label htmlFor="refund_amount">Refund Amount</Label>
              <Input
                id="refund_amount"
                type="number"
                value={refundData.amount}
                onChange={(e) => setRefundData({ ...refundData, amount: parseFloat(e.target.value) || 0 })}
                max={selectedTransaction?.amount || 0}
              />
            </div>
            <div>
              <Label htmlFor="refund_reason">Reason for Refund</Label>
              <Textarea
                id="refund_reason"
                value={refundData.reason}
                onChange={(e) => setRefundData({ ...refundData, reason: e.target.value })}
                placeholder="Explain the reason for this refund..."
              />
            </div>
            <div className="flex space-x-2 pt-4">
              <Button
                onClick={handleRefund}
                disabled={refundLoading || !refundData.reason || refundData.amount <= 0}
                className="flex-1"
              >
                {refundLoading ? 'Processing...' : 'Create Refund'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRefundDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};