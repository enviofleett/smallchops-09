import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { getBusinessContactInfo } from "@/utils/businessContact";

export const WhatsAppSupportWidget = () => {
  const { data: businessSettings } = useBusinessSettings();
  
  const formatWhatsAppNumber = (number: string) => {
    const cleanNumber = number.replace(/\D/g, '');
    return cleanNumber.startsWith('234') ? cleanNumber : `234${cleanNumber.replace(/^0/, '')}`;
  };

  const openWhatsAppChat = () => {
    if (businessSettings?.whatsapp_support_number) {
      const formattedNumber = formatWhatsAppNumber(businessSettings.whatsapp_support_number);
      const message = encodeURIComponent("Hi! I need help placing an order. Can you assist me?");
      const whatsappUrl = `https://wa.me/${formattedNumber}?text=${message}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const callSupport = () => {
    const fallbackContact = getBusinessContactInfo();
    window.open(`tel:${fallbackContact.phone}`, '_self');
  };

  // If WhatsApp number is configured, show WhatsApp support
  if (businessSettings?.whatsapp_support_number) {
    return (
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <MessageCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Need help placing this order?</p>
          <p className="text-sm text-muted-foreground">Chat with us on WhatsApp for instant support</p>
        </div>
        <Button
          onClick={openWhatsAppChat}
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Chat Now
        </Button>
      </div>
    );
  }

  // Fallback to phone support if WhatsApp not configured
  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <Phone className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Need help placing this order?</p>
        <p className="text-sm text-muted-foreground">
          Please call us on <span className="font-medium text-foreground">0807 301 1100</span>
        </p>
      </div>
      <Button
        onClick={callSupport}
        size="sm"
        variant="outline"
      >
        <Phone className="h-4 w-4 mr-2" />
        Call Now
      </Button>
    </div>
  );
};