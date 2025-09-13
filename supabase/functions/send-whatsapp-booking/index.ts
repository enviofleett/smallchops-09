import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingData {
  full_name: string;
  email: string;
  phone_number: string;
  event_date: string;
  number_of_guests: number;
  additional_details?: string;
  event_type: string;
  is_company_order: boolean;
  company_name?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking }: { booking: BookingData } = await req.json();

    // Format WhatsApp message
    const eventTypeMap: { [key: string]: string } = {
      'weddings': 'Wedding',
      'office_event': 'Office Event',
      'funerals': 'Funeral'
    };

    const eventTypeName = eventTypeMap[booking.event_type] || booking.event_type;
    
    let message = `🎉 *New Catering Booking Request*\n\n`;
    message += `👤 *Customer:* ${booking.full_name}\n`;
    message += `📧 *Email:* ${booking.email}\n`;
    message += `📱 *Phone:* ${booking.phone_number}\n`;
    message += `🎭 *Event Type:* ${eventTypeName}\n`;
    message += `📅 *Event Date:* ${booking.event_date}\n`;
    message += `👥 *Guests:* ${booking.number_of_guests}\n`;
    
    if (booking.is_company_order && booking.company_name) {
      message += `🏢 *Company Order:* ${booking.company_name}\n`;
    }
    
    if (booking.additional_details) {
      message += `📝 *Details:* ${booking.additional_details}\n`;
    }
    
    message += `\n⏰ *Received:* ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`;

    // Send WhatsApp message using WhatsApp Business API or similar service
    const whatsappNumber = "2348073011100"; // Formatted for WhatsApp API
    
    console.log('WhatsApp message prepared for:', whatsappNumber);
    console.log('Message content:', message);
    
    // For now, we'll log the message. In production, you'd integrate with:
    // - WhatsApp Business API
    // - Twilio WhatsApp API
    // - Or similar service
    
    // Example integration would be:
    // const response = await fetch('https://api.whatsapp.com/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${Deno.env.get('WHATSAPP_API_TOKEN')}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     messaging_product: "whatsapp",
    //     to: whatsappNumber,
    //     type: "text",
    //     text: { body: message }
    //   })
    // });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'WhatsApp notification prepared',
      whatsappNumber,
      messageContent: message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-whatsapp-booking function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});