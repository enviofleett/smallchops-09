import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createTransport } from "npm:nodemailer@6.9.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  orderData?: {
    orderId: string;
    orderNumber: string;
    status: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text, orderData }: EmailRequest = await req.json();

    console.log('📧 Sending order email:', { 
      to, 
      subject, 
      orderNumber: orderData?.orderNumber,
      status: orderData?.status
    });

    // Validate required fields
    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html');
    }

    // Get Gmail SMTP credentials from environment
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPass = Deno.env.get('GMAIL_PASS');

    if (!gmailUser || !gmailPass) {
      throw new Error('Gmail SMTP credentials not configured. Please set GMAIL_USER and GMAIL_PASS environment variables.');
    }

    // Create nodemailer transporter with Gmail SMTP
    const transporter = createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass, // Use Gmail App Password
      },
      secure: true,
      logger: false,
      debug: false
    });

    // Verify SMTP connection
    try {
      await transporter.verify();
      console.log('✅ Gmail SMTP connection verified');
    } catch (verifyError) {
      console.error('❌ Gmail SMTP verification failed:', verifyError);
      throw new Error(`SMTP verification failed: ${verifyError.message}`);
    }

    // Send email
    const mailOptions = {
      from: {
        name: 'Starters Small Chops',
        address: gmailUser
      },
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      headers: {
        'X-Order-ID': orderData?.orderId,
        'X-Order-Number': orderData?.orderNumber,
        'X-Order-Status': orderData?.status,
        'X-Mailer': 'Starters-SmallChops-OrderSystem'
      }
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully:', {
      messageId: info.messageId,
      to: to,
      orderNumber: orderData?.orderNumber,
      accepted: info.accepted,
      rejected: info.rejected
    });

    // Close transporter
    transporter.close();

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        to: to,
        orderNumber: orderData?.orderNumber,
        status: orderData?.status,
        message: 'Email sent successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('💥 Email sending failed:', error);

    // Determine appropriate error status
    let status = 500;
    if (error.message.includes('credentials') || error.message.includes('authentication')) {
      status = 401;
    } else if (error.message.includes('required fields')) {
      status = 400;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Check edge function logs for more information',
        timestamp: new Date().toISOString()
      }),
      {
        status: status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);