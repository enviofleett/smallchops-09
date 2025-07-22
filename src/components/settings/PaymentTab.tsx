import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PaymentTab = () => {
  const { toast } = useToast();
  const [payment, setPayment] = useState<any>({
    provider: "paystack",
    public_key: "",
    secret_key: "",
    mode: "test",
    webhook_url: "",
    currency: "NGN",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("payment-integration", {
          method: "GET",
        });
        if (error || data?.error) {
          toast({
            title: "Error loading payment settings",
            description: error?.message || data?.error || "An error occurred.",
            variant: "destructive",
          });
        } else if (data?.data) {
          setPayment(data.data);
        }
      } catch (e: any) {
        toast({
          title: "Network Error",
          description: e.message || String(e),
          variant: "destructive",
        });
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPayment({ ...payment, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!payment.provider) {
      toast({
        title: "Provider is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-integration", {
        body: { ...payment, provider: "paystack" },
      });

      if (error || data?.error) {
        toast({
          title: "Error",
          description: error?.message || data?.error || "Unable to save payment settings.",
          variant: "destructive",
        });
      } else if (data?.data) {
        toast({ title: "Paystack API settings updated" });
        setPayment(data.data);
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err.message || String(err),
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <Card className="max-w-lg p-6">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold mb-2">Paystack Integration</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Public Key</label>
          <Input 
            name="public_key" 
            value={payment.public_key || ""} 
            onChange={handleChange} 
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Secret Key</label>
          <Input 
            name="secret_key" 
            type="password" 
            value={payment.secret_key || ""} 
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Webhook URL</label>
          <Input 
            name="webhook_url" 
            value={payment.webhook_url || ""} 
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <Input 
            name="currency" 
            value={payment.currency || ""} 
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mode</label>
          <Input 
            name="mode" 
            value={payment.mode || ""} 
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Card>
  );
};

export default PaymentTab;
