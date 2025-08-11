import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { paystackService } from '@/lib/paystack';
import { PaystackButton } from '@/components/payments/PaystackButton';
import { toast } from 'sonner';

export default function PaystackTest() {
  const [config, setConfig] = useState<any>(null);
  const [verifyReference, setVerifyReference] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [testPayment, setTestPayment] = useState({
    email: 'test@example.com',
    amount: 1000,
    customerName: 'Test Customer'
  });
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);

  useEffect(() => {
    loadConfig();
    loadBanks();
  }, []);

  const loadConfig = async () => {
    try {
      const configData = await paystackService.getConfig();
      setConfig(configData);
    } catch (error) {
      console.error('Failed to load config:', error);
      toast.error('Failed to load Paystack configuration');
    }
  };

  const loadBanks = async () => {
    try {
      const banksData = await paystackService.getBanks();
      setBanks(banksData || []);
    } catch (error) {
      console.error('Failed to load banks:', error);
    }
  };

  const handleVerifyPayment = async () => {
    if (!verifyReference.trim()) {
      toast.error('Please enter a payment reference');
      return;
    }

    setLoading(true);
    try {
      const result = await paystackService.verifyTransaction(verifyReference.trim());
      setVerificationResult(result);
      toast.success('Payment verified successfully');
    } catch (error) {
      console.error('Verification failed:', error);
      toast.error(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setVerificationResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (reference: string, transaction: any) => {
    toast.success(`Payment successful! Reference: ${reference}`);
    setVerifyReference(reference);
    console.log('Payment success:', { reference, transaction });
  };

  const handlePaymentError = (error: string) => {
    toast.error(`Payment failed: ${error}`);
    console.error('Payment error:', error);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      success: 'bg-green-500',
      failed: 'bg-red-500',
      pending: 'bg-yellow-500',
      abandoned: 'bg-gray-500'
    };

    return (
      <Badge className={`${colors[status as keyof typeof colors] || 'bg-gray-500'} text-white`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Paystack Integration Test</h1>
        <p className="text-muted-foreground">
          Test Paystack payment functionality and verify transactions
        </p>
      </div>

      {/* Configuration Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {config ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Public Key:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {config.public_key ? `${config.public_key.substring(0, 20)}...` : 'Not loaded'}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span>Test Mode:</span>
                <Badge variant={config.test_mode ? 'secondary' : 'default'}>
                  {config.test_mode ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Loading configuration...</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="payment" className="space-y-6">
        <TabsList>
          <TabsTrigger value="payment">Test Payment</TabsTrigger>
          <TabsTrigger value="verify">Verify Payment</TabsTrigger>
          <TabsTrigger value="banks">Banks List</TabsTrigger>
        </TabsList>

        {/* Test Payment Tab */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Test Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={testPayment.email}
                    onChange={(e) => setTestPayment(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    value={testPayment.customerName}
                    onChange={(e) => setTestPayment(prev => ({ ...prev, customerName: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="amount">Amount (₦)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  value={testPayment.amount}
                  onChange={(e) => setTestPayment(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Amount in Naira (minimum: ₦1.00)
                </p>
              </div>

              <div className="pt-4">
                <PaystackButton
                  email={testPayment.email}
                  amount={testPayment.amount}
                  orderId={`test_order_${Date.now()}`}
                  customerName={testPayment.customerName}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  className="w-full"
                  metadata={{
                    test: true,
                    source: 'paystack-test-page'
                  }}
                >
                  Pay {paystackService.formatCurrency(testPayment.amount)}
                </PaystackButton>
              </div>

              <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
                <p className="font-medium mb-1">Test Card Details:</p>
                <p>Card: 4084 0840 8408 4081</p>
                <p>Expiry: Any future date</p>
                <p>CVV: Any 3 digits</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verify Payment Tab */}
        <TabsContent value="verify">
          <Card>
            <CardHeader>
              <CardTitle>Verify Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="verifyReference">Payment Reference</Label>
                <Input
                  id="verifyReference"
                  value={verifyReference}
                  onChange={(e) => setVerifyReference(e.target.value)}
                  placeholder="e.g. txn_1234567890_abcdef"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a payment reference to verify its status. Server-generated references start with 'txn_'.
                </p>
              </div>

              <Button onClick={handleVerifyPayment} disabled={loading} className="w-full">
                {loading ? 'Verifying...' : 'Verify Payment'}
              </Button>

              {verificationResult && (
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getStatusIcon(verificationResult.status)}
                      Verification Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label>Status:</Label>
                          <div className="mt-1">
                            {getStatusBadge(verificationResult.status)}
                          </div>
                        </div>
                        <div>
                          <Label>Reference:</Label>
                          <code className="block mt-1 text-xs bg-muted p-1 rounded break-all">
                            {verificationResult.reference}
                          </code>
                        </div>
                        <div>
                          <Label>Amount:</Label>
                          <p className="mt-1 font-mono">
                            ₦{(verificationResult.amount / 100).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <Label>Channel:</Label>
                          <p className="mt-1 capitalize">{verificationResult.channel}</p>
                        </div>
                      </div>

                      {verificationResult.paid_at && (
                        <div>
                          <Label>Paid At:</Label>
                          <p className="mt-1 text-sm">
                            {new Date(verificationResult.paid_at).toLocaleString()}
                          </p>
                        </div>
                      )}

                      {verificationResult.gateway_response && (
                        <div>
                          <Label>Gateway Response:</Label>
                          <p className="mt-1 text-sm">{verificationResult.gateway_response}</p>
                        </div>
                      )}

                      {verificationResult.authorization && (
                        <div>
                          <Label>Authorization:</Label>
                          <div className="mt-1 text-sm space-y-1">
                            <p>Card: {verificationResult.authorization.card_type} ****{verificationResult.authorization.last4}</p>
                            <p>Bank: {verificationResult.authorization.bank}</p>
                            {verificationResult.authorization.account_name && (
                              <p>Account: {verificationResult.authorization.account_name}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {verificationResult.fees && (
                        <div>
                          <Label>Transaction Fees:</Label>
                          <p className="mt-1 font-mono text-sm">
                            ₦{(verificationResult.fees / 100).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banks List Tab */}
        <TabsContent value="banks">
          <Card>
            <CardHeader>
              <CardTitle>Supported Banks</CardTitle>
            </CardHeader>
            <CardContent>
              {banks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {banks.map((bank) => (
                    <div key={bank.id} className="p-2 text-sm border rounded">
                      <p className="font-medium">{bank.name}</p>
                      <p className="text-xs text-muted-foreground">{bank.code}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Loading banks...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
