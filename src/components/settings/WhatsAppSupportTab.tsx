import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, ExternalLink, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { supabase } from "@/integrations/supabase/client";

export const WhatsAppSupportTab = () => {
  const { data: businessSettings, invalidateSettings } = useBusinessSettings();
  const [whatsappNumber, setWhatsappNumber] = useState(
    businessSettings?.whatsapp_support_number || ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast({
          title: "Authentication required",
          description: "Please sign in to update WhatsApp settings",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('business-settings', {
        body: { whatsapp_support_number: whatsappNumber },
        headers: {
          authorization: `Bearer ${session.session.access_token}`,
        }
      });

      if (error) throw error;

      await invalidateSettings();
      
      toast({
        title: "WhatsApp support updated",
        description: "Customer support WhatsApp number has been saved successfully"
      });
    } catch (error) {
      console.error('Error updating WhatsApp settings:', error);
      toast({
        title: "Error updating settings",
        description: "Failed to save WhatsApp support number",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatWhatsAppNumber = (number: string) => {
    // Remove all non-digits and ensure it starts with country code
    const cleanNumber = number.replace(/\D/g, '');
    return cleanNumber.startsWith('234') ? cleanNumber : `234${cleanNumber.replace(/^0/, '')}`;
  };

  const getWhatsAppPreviewUrl = () => {
    if (!whatsappNumber) return '';
    const formattedNumber = formatWhatsAppNumber(whatsappNumber);
    const message = encodeURIComponent("Hi! I need help with my order.");
    return `https://wa.me/${formattedNumber}?text=${message}`;
  };

  const testWhatsAppLink = () => {
    const url = getWhatsAppPreviewUrl();
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({
        title: "No number configured",
        description: "Please enter a WhatsApp number first",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Customer Support
          </CardTitle>
          <CardDescription>
            Configure WhatsApp number for customer support. This will replace the phone support on product pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-number">WhatsApp Number</Label>
            <Input
              id="whatsapp-number"
              placeholder="e.g., 08073011100 or +2348073011100"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Enter the number with country code (234 for Nigeria). Format: +2348073011100 or 08073011100
            </p>
          </div>

          {whatsappNumber && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium">Preview</h4>
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span>WhatsApp: +{formatWhatsAppNumber(whatsappNumber)}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testWhatsAppLink}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Test WhatsApp Link
              </Button>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isLoading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            Understanding WhatsApp customer support integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-primary">1</span>
            </div>
            <div>
              <p className="font-medium">Product Page Integration</p>
              <p className="text-sm text-muted-foreground">
                The phone support section on product pages will be replaced with a WhatsApp chat button
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-primary">2</span>
            </div>
            <div>
              <p className="font-medium">Direct Customer Contact</p>
              <p className="text-sm text-muted-foreground">
                Customers can click the WhatsApp button to start a conversation with your support team
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-primary">3</span>
            </div>
            <div>
              <p className="font-medium">Pre-filled Message</p>
              <p className="text-sm text-muted-foreground">
                The WhatsApp chat will open with a pre-filled message to help customers get started
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};