import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clipboard, Clock, Copy, Info, ListChecks, Trash2 } from 'lucide-react';
import { paystackService, validateReferenceForVerification } from '@/lib/paystack';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { usePaystackConfig } from '@/hooks/usePaystackConfig';

interface RecentRef {
  ref: string;
  at: number;
}

const RECENT_KEY = 'recent_paystack_references';

const useRecentReferences = () => {
  const [items, setItems] = useState<RecentRef[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: RecentRef[]) => {
    setItems(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, 8)));
    } catch {}
  };

  const add = (ref: string) => {
    const trimmed = ref.trim();
    if (!trimmed) return;
    const next = [{ ref: trimmed, at: Date.now() }, ...items.filter(i => i.ref !== trimmed)];
    persist(next);
  };

  const clear = () => persist([]);

  return { items, add, clear };
};

export const PaymentDebugPanel: React.FC = () => {
  const [reference, setReference] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const { config, loading: cfgLoading } = usePaystackConfig();
  const { items: recent, add: addRecent, clear: clearRecent } = useRecentReferences();

  const maskedKey = useMemo(() => {
    const key = config?.publicKey || '';
    if (!key) return 'pk_••••••••';
    if (key.length <= 8) return `${key.slice(0, 2)}•••`;
    return `${key.slice(0, 6)}…${key.slice(-2)}`;
  }, [config?.publicKey]);

  const handleVerifyPayment = async () => {
    const ref = reference.trim();
    if (!ref) {
      toast.error('Please enter a payment reference');
      return;
    }

    if (!validateReferenceForVerification(ref)) {
      toast.warning('Reference format looks unusual; attempting verification anyway');
    }

    setLoading(true);
    try {
      const result = await paystackService.verifyTransaction(ref);
      setVerificationResult(result);
      addRecent(ref);
      toast.success('Verification completed');
    } catch (error) {
      console.error('Verification error:', error);
      toast.error(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setVerificationResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTestInlinePayment = async () => {
    if (!testMode) {
      toast.error('Enable test mode to initialize a test payment');
      return;
    }

    setLoading(true);
    try {
      const result = await paystackService.initializeTransaction({
        email: 'test@example.com',
        amount: paystackService.formatAmount(1000),
        metadata: { test: true, debug: true, source: 'debug-panel' }
      });

      if (result.reference && result.authorization_url) {
        addRecent(result.reference);
        setReference(result.reference);
        toast.success(`Test payment initialized: ${result.reference}`);
        window.open(result.authorization_url, '_blank');
      } else {
        toast.error('Initialization response missing URL/reference');
      }
    } catch (error) {
      console.error('Test initialization error:', error);
      toast.error(`Test initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toLowerCase();
    const map: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      success: 'default',
      paid: 'default',
      failed: 'destructive',
      pending: 'secondary',
      abandoned: 'secondary',
    };
    const variant = map[s] || 'outline';
    return <Badge variant={variant}>{status || 'unknown'}</Badge>;
  };

  const copyRef = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      toast.success('Reference copied');
    } catch {}
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Helmet>
        <title>Paystack Debug Panel</title>
        <meta name="description" content="Paystack debug panel to verify transactions and run test initializations." />
        <link rel="canonical" href={`${window.location.origin}/settings#payment-providers`} />
      </Helmet>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Paystack Debug Panel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="testMode"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="testMode" className="text-sm text-muted-foreground">
              Enable test mode (allows test payment initialization)
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Public key</div>
              <code className="text-xs break-all">{cfgLoading ? 'loading…' : maskedKey}</code>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Mode</div>
              <Badge variant={(config?.isTestMode ? 'secondary' : 'default')}>{config?.isTestMode ? 'Test' : 'Live'}</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Config</div>
              <Badge variant={config?.isValid ? 'default' : 'destructive'}>
                {config?.isValid ? 'Valid' : 'Invalid'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Verify Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="reference">Payment Reference</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. txn_123... or legacy reference"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Server-generated references start with 'txn_'. Legacy references may use other formats.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleVerifyPayment} disabled={loading} variant="outline">
              Verify Payment
            </Button>
            {testMode && (
              <Button onClick={handleTestInlinePayment} disabled={loading} variant="secondary">
                Initialize Test Payment
              </Button>
            )}
          </div>

          {recent.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" /> Recent references
                </div>
                <Button size="sm" variant="ghost" onClick={clearRecent}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map(({ ref, at }) => (
                  <Button key={ref} variant="outline" size="sm" onClick={() => setReference(ref)}>
                    <Clipboard className="h-3 w-3 mr-1" />
                    <span className="font-mono text-xs">{ref}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={(e) => { e.stopPropagation(); copyRef(ref); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {verificationResult && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Verification Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Status</Label>
                    <div className="mt-1">{getStatusBadge(verificationResult.status || verificationResult.payment_status)}</div>
                  </div>
                  <div>
                    <Label>Reference</Label>
                    <code className="block mt-1 text-xs bg-muted p-1 rounded">{verificationResult.reference || verificationResult.data?.reference}</code>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <p className="mt-1 font-mono">
                      {typeof verificationResult.amount === 'number'
                        ? `₦${(verificationResult.amount / 100).toFixed(2)}`
                        : (typeof verificationResult.data?.amount === 'number'
                          ? `₦${(verificationResult.data.amount / 100).toFixed(2)}`
                          : '—')}
                    </p>
                  </div>
                  <div>
                    <Label>Channel</Label>
                    <p className="mt-1">{verificationResult.channel || verificationResult.data?.channel || '—'}</p>
                  </div>
                </div>

                {verificationResult.paid_at && (
                  <div>
                    <Label>Paid At</Label>
                    <p className="mt-1 text-sm">{new Date(verificationResult.paid_at).toLocaleString()}</p>
                  </div>
                )}

                {verificationResult.gateway_response && (
                  <div>
                    <Label>Gateway Response</Label>
                    <p className="mt-1 text-sm">{verificationResult.gateway_response}</p>
                  </div>
                )}

                {verificationResult.authorization && (
                  <div>
                    <Label>Card Info</Label>
                    <p className="mt-1 text-sm">
                      {verificationResult.authorization.card_type} ****{verificationResult.authorization.last4}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Reference Format Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            New server-generated references start with <code className="px-1 bg-muted rounded">txn_</code> and are the preferred format
            for verification and reconciliation. Older or manually created references may use other formats and will still be attempted
            for verification.
          </p>
          <p>
            If a reference verification fails, ensure you copied it exactly from the payment/transaction details. You can also try again
            in a few minutes in case of propagation delays.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
