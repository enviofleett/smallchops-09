import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EnvioApiTab = () => {
  const { toast } = useToast();
  const [shipping, setShipping] = useState<any>({
    provider: "envio",
    token: "",
    status: "",
    delivery_time: "",
    shipping_rates: "",
    zones: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("shipping-integration", {
          method: "GET",
        });
        if (error || data?.error) {
          toast({
            title: "Error loading shipping settings",
            description: error?.message || data?.error || "An error occurred.",
            variant: "destructive",
          });
        } else if (data?.data) {
          const item = data.data;
          setShipping({
            provider: item.provider || "envio",
            token: item.token || "",
            status: item.status || "",
            delivery_time: item.delivery_time || "",
            shipping_rates: item.shipping_rates 
              ? typeof item.shipping_rates === "string" 
                ? item.shipping_rates 
                : JSON.stringify(item.shipping_rates)
              : "",
            zones: item.zones 
              ? typeof item.zones === "string" 
                ? item.zones 
                : JSON.stringify(item.zones)
              : "",
          });
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
    setShipping({ ...shipping, [e.target.name]: e.target.value });
  };

  const isJson = (str: string) => {
    if (!str.trim()) return true;
    try {
      const val = JSON.parse(str);
      return typeof val === "object";
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shipping.provider) {
      toast({
        title: "Provider is required",
        variant: "destructive",
      });
      return;
    }

    if (shipping.shipping_rates && !isJson(shipping.shipping_rates)) {
      toast({
        title: "Shipping Rates must be valid JSON",
        description: 'e.g. {"standard": 100}',
        variant: "destructive",
      });
      return;
    }

    if (shipping.zones && !isJson(shipping.zones)) {
      toast({
        title: "Zones must be valid JSON",
        description: 'e.g. {"zone1": "Lagos"}',
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Parse JSON fields safely
    let shipping_rates_value: any = null;
    let zones_value: any = null;

    if (shipping.shipping_rates?.trim()) {
      try {
        shipping_rates_value = JSON.parse(shipping.shipping_rates);
      } catch {
        shipping_rates_value = null;
      }
    }

    if (shipping.zones?.trim()) {
      try {
        zones_value = JSON.parse(shipping.zones);
      } catch {
        zones_value = null;
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke("shipping-integration", {
        body: {
          ...shipping,
          provider: "envio",
          shipping_rates: shipping_rates_value,
          zones: zones_value,
        },
      });

      if (error || data?.error) {
        toast({
          title: "Error",
          description: error?.message || data?.error || "Unable to save shipping settings.",
          variant: "destructive",
        });
      } else if (data?.data) {
        toast({ title: "Envio API settings updated" });
        const item = data.data;
        setShipping({
          provider: item.provider || "envio",
          token: item.token || "",
          status: item.status || "",
          delivery_time: item.delivery_time || "",
          shipping_rates: item.shipping_rates 
            ? typeof item.shipping_rates === "string" 
              ? item.shipping_rates 
              : JSON.stringify(item.shipping_rates)
            : "",
          zones: item.zones 
            ? typeof item.zones === "string" 
              ? item.zones 
              : JSON.stringify(item.zones)
            : "",
        });
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
        <h2 className="text-xl font-bold mb-2">Envio API Connection</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Connection Token</label>
          <Input 
            name="token" 
            value={shipping.token || ""} 
            onChange={handleChange} 
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <Input 
            name="status" 
            value={shipping.status || ""} 
            onChange={handleChange} 
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Delivery Time (mins)</label>
          <Input 
            name="delivery_time" 
            value={shipping.delivery_time || ""} 
            onChange={handleChange} 
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Shipping Rates (JSON)</label>
          <Input 
            name="shipping_rates" 
            value={shipping.shipping_rates || ""} 
            onChange={handleChange} 
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Zones (JSON)</label>
          <Input 
            name="zones" 
            value={shipping.zones || ""} 
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

export default EnvioApiTab;
