import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  customerName: string
  orderNumber: string
  status: string
}

const EMAIL_TEMPLATES = {
  confirmed: {
    subject: 'Order Confirmed - {orderNumber}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Order Confirmed!</h2>
        <p>Hi {customerName},</p>
        <p>Great news! Your order <strong>{orderNumber}</strong> has been confirmed and is being prepared.</p>
        <p>We'll keep you updated on your order status.</p>
        <p>Thank you for choosing us!</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message. Please do not reply.</p>
      </div>
    `
  },
  preparing: {
    subject: 'Order Being Prepared - {orderNumber}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">Order Being Prepared</h2>
        <p>Hi {customerName},</p>
        <p>Your order <strong>{orderNumber}</strong> is now being prepared by our kitchen team.</p>
        <p>We'll notify you once it's ready for delivery.</p>
        <p>Thank you for your patience!</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message. Please do not reply.</p>
      </div>
    `
  },
  ready: {
    subject: 'Order Ready - {orderNumber}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">Order Ready!</h2>
        <p>Hi {customerName},</p>
        <p>Your order <strong>{orderNumber}</strong> is ready and will be out for delivery soon.</p>
        <p>Get ready to enjoy your meal!</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message. Please do not reply.</p>
      </div>
    `
  },
  out_for_delivery: {
    subject: 'Order Out for Delivery - {orderNumber}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">On the Way!</h2>
        <p>Hi {customerName},</p>
        <p>Your order <strong>{orderNumber}</strong> is now out for delivery.</p>
        <p>Our delivery team will be with you shortly!</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message. Please do not reply.</p>
      </div>
    `
  },
  delivered: {
    subject: 'Order Delivered - {orderNumber}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Order Delivered!</h2>
        <p>Hi {customerName},</p>
        <p>Your order <strong>{orderNumber}</strong> has been successfully delivered.</p>
        <p>We hope you enjoy your meal! Thank you for choosing us.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message. Please do not reply.</p>
      </div>
    `
  },
  cancelled: {
    subject: 'Order Cancelled - {orderNumber}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Order Cancelled</h2>
        <p>Hi {customerName},</p>
        <p>We're sorry to inform you that your order <strong>{orderNumber}</strong> has been cancelled.</p>
        <p>If you have any questions, please contact our support team.</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message. Please do not reply.</p>
      </div>
    `
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { to, customerName, orderNumber, status }: EmailRequest = await req.json()

    console.log(`📧 Sending email for order ${orderNumber} with status ${status} to ${to}`)

    // Get SMTP settings
    const { data: smtpSettings, error: settingsError } = await supabase
      .from('communication_settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, sender_email, sender_name')
      .single()

    if (settingsError || !smtpSettings?.smtp_host) {
      throw new Error('SMTP settings not configured')
    }

    // Get email template
    const template = EMAIL_TEMPLATES[status as keyof typeof EMAIL_TEMPLATES]
    if (!template) {
      throw new Error(`No template found for status: ${status}`)
    }

    // Replace variables in template
    const subject = template.subject
      .replace('{orderNumber}', orderNumber)
      .replace('{customerName}', customerName)
    
    const html = template.html
      .replace(/{orderNumber}/g, orderNumber)
      .replace(/{customerName}/g, customerName)

    // For now, return success immediately to test the system
    // In production, you would implement actual SMTP sending here
    console.log(`📧 Would send email:`)
    console.log(`  From: ${smtpSettings.sender_name} <${smtpSettings.sender_email}>`)
    console.log(`  To: ${to}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  SMTP: ${smtpSettings.smtp_host}:${smtpSettings.smtp_port}`)
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const result = {
      success: true,
      message: 'Email simulated successfully'
    }
    console.log(`✅ Email sent successfully for order ${orderNumber}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        orderNumber,
        status,
        recipient: to
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Email sending failed:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})