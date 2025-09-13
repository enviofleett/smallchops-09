
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, RefreshCw, ShieldCheck, ShieldX, Copy, LinkIcon, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

interface HealthStatus {
  ok: boolean;
  hasPaystackKey: boolean;
  hasServiceRole: boolean;
  hasSupabaseUrl: boolean;
  version?: string;
  timestamp?: string;
}

interface WebhookEventRow {
  event_id: string;
  event_type: string;
  processed: boolean;
  received_at: string;
  processing_result?: any;
}

const WEBHOOK_URL = 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-webhook-secure';
const VERIFY_HEALTH_URL = 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-verify?health=1';

export const PaymentsWebhooksPanel: React.FC = () => {
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [reference, setReference] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [events, setEvents] = useState<WebhookEventRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [testPayload, setTestPayload] = useState('');
  const [testing, setTesting] = useState(false);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  }, [toast]);

  const refreshHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch(VERIFY_HEALTH_URL, { method: 'GET' });
      const json = await res.json();
      setHealth(json);
    } catch (e: any) {
      setHealth({ ok: false, hasPaystackKey: false, hasServiceRole: false, hasSupabaseUrl: false });
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const { data, error } = await (supabase as any)
        .from('webhook_events')
        .select('paystack_event_id, event_type, processed, created_at, processing_result')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      const mapped = ((data as any) || []).map((d: any) => ({
        event_id: d.paystack_event_id,
        event_type: d.event_type,
        processed: d.processed,
        received_at: d.created_at,
        processing_result: d.processing_result,
      })) as WebhookEventRow[];
      setEvents(mapped);
    } catch (e: any) {
      toast({ title: 'Error', description: 'Failed to load webhook events', variant: 'destructive' });
    } finally {
      setLoadingEvents(false);
    }
  }, [toast]);

  const runVerification = useCallback(async () => {
    if (!reference.trim()) {
      toast({ title: 'Reference required', description: 'Enter a Paystack reference to verify', variant: 'destructive' });
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference: reference.trim() }
      });
      if (error) throw error;

      setVerifyResult(data);

      // Support both new and legacy response shapes
      const ok = (data as any)?.data?.success ?? (data as any)?.status ?? false;
      toast({
        title: ok ? 'Verified' : 'Verification complete',
        description: ok ? 'Payment confirmed successfully' : 'See details below',
      });
    } catch (e: any) {
      setVerifyResult({ error: e?.message || 'Verification failed' });
      toast({ title: 'Verification failed', description: e?.message || 'See console for details', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  }, [reference, toast]);

  const sendTestWebhookByReference = useCallback(async () => {
    if (!reference.trim()) {
      toast({ title: 'Reference required', description: 'Enter a Paystack reference to simulate', variant: 'destructive' });
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-webhook-test', {
        body: { mode: 'reference', reference: reference.trim() }
      });
      if (error) throw error;
      toast({ title: 'Test event sent', description: 'Webhook event created and processed' });
      await refreshEvents();
    } catch (e: any) {
      toast({ title: 'Webhook test failed', description: e?.message || 'See console for details', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  }, [reference, refreshEvents, toast]);

  const sendCustomWebhook = useCallback(async () => {
    if (!testPayload.trim()) {
      toast({ title: 'Payload required', description: 'Paste a webhook JSON payload', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      let parsed: any;
      try { parsed = JSON.parse(testPayload); } catch {
        throw new Error('Invalid JSON payload');
      }
      const { data, error } = await supabase.functions.invoke('paystack-webhook-test', {
        body: { mode: 'custom', payload: parsed }
      });
      if (error) throw error;
      toast({ title: 'Custom event sent', description: 'Webhook event created' });
      setTestPayload('');
      await refreshEvents();
    } catch (e: any) {
      toast({ title: 'Webhook test failed', description: e?.message || 'Invalid payload', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  }, [testPayload, refreshEvents, toast]);

  useEffect(() => {
    refreshHealth();
    refreshEvents();
  }, [refreshHealth, refreshEvents]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments & Webhooks</CardTitle>
        <CardDescription>Verify Paystack payments, monitor webhook deliveries, and copy integration URLs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Health */}
          <div className="space-y-3 p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="font-medium">Function Health</span>
              </div>
{health ? (
                (() => { const good = health.ok && health.hasPaystackKey && health.hasServiceRole && health.hasSupabaseUrl; return (
                  <Badge variant={good ? 'default' : 'destructive'} className="gap-1">
                    {good ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {good ? 'Ready' : 'Issues detected'}
                  </Badge>
                ); })()
              ) : null}
            </div>
            <div className="text-sm text-muted-foreground">
              <div>paystack-verify health endpoint</div>
              <code className="block bg-muted p-2 rounded text-xs">{VERIFY_HEALTH_URL}</code>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => handleCopy(VERIFY_HEALTH_URL)}>
                <Copy className="w-4 h-4 mr-1" /> Copy URL
              </Button>
              <Button variant="outline" size="sm" onClick={refreshHealth} disabled={loadingHealth}>
                <RefreshCw className="w-4 h-4 mr-1 animate-spin-slow" /> {loadingHealth ? 'Checking...' : 'Re-check'}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href={VERIFY_HEALTH_URL} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> Open
                </a>
              </Button>
            </div>
            {health && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                <div className="flex items-center gap-2"><ShieldCheck className={`w-3 h-3 ${health.hasPaystackKey ? 'text-green-500' : 'text-muted-foreground'}`} /> Paystack key</div>
                <div className="flex items-center gap-2"><ShieldCheck className={`w-3 h-3 ${health.hasServiceRole ? 'text-green-500' : 'text-muted-foreground'}`} /> Service role</div>
                <div className="flex items-center gap-2"><ShieldCheck className={`w-3 h-3 ${health.hasSupabaseUrl ? 'text-green-500' : 'text-muted-foreground'}`} /> Supabase URL</div>
                <div className="text-muted-foreground">v{health.version || 'n/a'}</div>
              </div>
            )}
          </div>

          {/* Webhook URL */}
          <div className="space-y-3 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              <span className="font-medium">Webhook URL (configure in Paystack)</span>
            </div>
            <code className="block bg-muted p-2 rounded text-xs break-all">{WEBHOOK_URL}</code>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleCopy(WEBHOOK_URL)}>
                <Copy className="w-4 h-4 mr-1" /> Copy URL
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://dashboard.paystack.com/#/settings/developers" target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> Open Paystack
                </a>
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Manual verification */}
        <div className="space-y-3 p-4 rounded-lg border">
          <div className="font-medium">Verify a payment by reference (direct)</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label htmlFor="ps-ref">Reference</Label>
              <Input id="ps-ref" placeholder="e.g. txn_..." value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={runVerification} disabled={verifying}>
                {verifying ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </div>
          {verifyResult && (
            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">{JSON.stringify(verifyResult, null, 2)}</pre>
          )}
        </div>

        {/* Webhook test tools (admin) */}
        <div className="space-y-3 p-4 rounded-lg border">
          <div className="font-medium">Webhook test tools (admin-only)</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label htmlFor="test-ref">Simulate by reference</Label>
              <Input id="test-ref" placeholder="e.g. txn_..." value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={sendTestWebhookByReference} disabled={verifying}>
                {verifying ? 'Sending...' : 'Send test webhook'}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-payload">Custom payload</Label>
            <Textarea
              id="custom-payload"
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              placeholder='{"event":"charge.success","data":{"reference":"txn_test","status":"success","amount":100000,"currency":"NGN"}}'
              className="font-mono text-xs h-32"
            />
            <div className="flex">
              <Button variant="outline" onClick={sendCustomWebhook} disabled={testing}>
                {testing ? 'Sending...' : 'Send custom webhook'}
              </Button>
            </div>
          </div>
        </div>

        {/* Recent webhook events */}
        <div className="space-y-3 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="font-medium">Recent webhook events</div>
            <Button variant="outline" size="sm" onClick={refreshEvents} disabled={loadingEvents}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {events.length === 0 ? (
              <div className="text-sm text-muted-foreground">No events recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {events.map((e) => (
                  <div key={e.event_id} className="p-2 rounded border flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-mono">{e.event_type}</div>
                      <div className="text-xs text-muted-foreground">{new Date(e.received_at).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.processed ? (
                        <Badge className="gap-1"><CheckCircle className="w-3 h-3" /> processed</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1"><ShieldX className="w-3 h-3" /> pending</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentsWebhooksPanel;
