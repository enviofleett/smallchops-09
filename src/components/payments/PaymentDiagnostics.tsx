import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Helmet } from "react-helmet-async";

interface VerifyResult {
  success: boolean;
  order_id?: string;
  order_number?: string;
  amount?: number;
  status?: string;
  message?: string;
  diagnostics?: {
    provided_reference?: string;
    effective_reference?: string;
    mapping_strategy?: string | null;
    provider_status?: number | null;
  };
}

export const PaymentDiagnostics: React.FC = () => {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const handleVerify = async () => {
    const raw = reference.trim();
    if (!raw) {
      toast.error("Enter a transaction reference");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      // Normalize: if user omitted txn_ prefix, add it
      let normalized = raw;
      let localHint: string | null = null;
      if (!/^txn_/.test(normalized)) {
        normalized = `txn_${normalized}`;
        localHint = "Auto-added txn_ prefix for verification";
      }
      setHint(localHint);
      if (localHint) setReference(normalized);

      const { data, error } = await supabase.functions.invoke("paystack-secure", {
        body: { action: "verify", reference: normalized },
      });

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Empty response");

      const payload = data.data || data;
      const success = payload?.status === "success" || payload?.payment_status === "paid";

      setResult({
        success,
        order_id: payload?.order_id,
        order_number: payload?.order_number,
        amount: typeof payload?.total_amount === "number"
          ? payload.total_amount
          : (typeof payload?.amount === "number" ? Math.round(payload.amount / 100) : undefined),
        status: payload?.payment_status || (typeof payload?.status === 'string' ? payload.status : undefined),
        message: success
          ? "Payment verified and order updated"
          : (payload?.message || payload?.error || payload?.gateway_response || "Verification failed"),
        diagnostics: !success && payload?.diagnostics ? {
          provided_reference: payload.diagnostics.provided_reference,
          effective_reference: payload.diagnostics.effective_reference,
          mapping_strategy: payload.diagnostics.mapping_strategy ?? null,
          provider_status: payload.diagnostics.provider_status ?? null,
        } : undefined,
      });

      toast[success ? "success" : "error"](success ? "Verified" : "Not Verified", {
        description: success ? "Order marked as paid (if successful)." : (payload?.message || "See details below."),
      });
    } catch (e: any) {
      console.error("Diagnostics verify error", e);
      toast.error("Verification failed", { description: e?.message || "Unknown error" });
      setResult({ success: false, message: e?.message || "Verification failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Helmet>
        <title>Payment Diagnostics | Admin</title>
        <meta name="description" content="Manually verify Paystack transactions by reference." />
        <link rel="canonical" href={`${window.location.origin}/admin/payments/diagnostics`} />
      </Helmet>
      <CardHeader>
        <CardTitle>Payment Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Enter Paystack reference (e.g. txn_...)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Button onClick={handleVerify} disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}

        {result && (
          <div className="border rounded-md p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={result.success ? "default" : "destructive"}>
                {result.success ? "Success" : "Failed"}
              </Badge>
              {result.status && <span className="text-muted-foreground">Status: {result.status}</span>}
            </div>
            {result.order_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Number</span>
                <span className="font-medium">{result.order_number}</span>
              </div>
            )}
            {typeof result.amount === "number" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">₦{result.amount.toLocaleString()}</span>
              </div>
            )}
            {result.message && (
              <div>
                <span className="text-muted-foreground">Message: </span>
                <span>{result.message}</span>
              </div>
            )}
            {result.diagnostics && (
              <div className="mt-2 rounded-md bg-muted p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provided Ref</span>
                  <span className="font-mono">{result.diagnostics.provided_reference || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Effective Ref</span>
                  <span className="font-mono">{result.diagnostics.effective_reference || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mapping</span>
                  <span className="font-mono">{result.diagnostics.mapping_strategy || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider Status</span>
                  <span className="font-mono">{typeof result.diagnostics.provider_status === 'number' ? result.diagnostics.provider_status : '-'}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
