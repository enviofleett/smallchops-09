import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { maskSMTPConfig, troubleshootingGuide } from '../utils/smtp-utils';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function sendEmail(emailRequest, smtpConfig) {
  // Enhanced config validation
  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass || !smtpConfig.sender) {
    throw new Error(
      'Incomplete SMTP configuration. Missing: ' +
      [
        !smtpConfig.host && 'host',
        !smtpConfig.user && 'user',
        !smtpConfig.pass && 'password',
        !smtpConfig.sender && 'sender'
      ].filter(Boolean).join(', ')
    );
  }

  // Port/security selection: Prefer 587 STARTTLS, fallback to 465
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port || 587,
    secure: (smtpConfig.port === 465), // true for 465, false for 587
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    },
    tls: { rejectUnauthorized: false }
  });

  let sendResult, deliveryTime;
  try {
    const start = Date.now();
    sendResult = await transporter.sendMail({
      from: smtpConfig.sender,
      to: emailRequest.to,
      subject: emailRequest.subject,
      html: emailRequest.html,
    });
    deliveryTime = Date.now() - start;

    // Delivery confirmation logging
    await supabase.from('smtp_delivery_confirmations').insert({
      email_id: sendResult.messageId,
      recipient_email: emailRequest.to,
      provider_used: smtpConfig.name,
      delivery_status: 'sent',
      delivery_time_ms: deliveryTime,
      message_id: sendResult.messageId,
      provider_response: { response: sendResult.response }
    });

    // Health metric logging
    await supabase.rpc('record_smtp_health_metric', {
      p_provider_name: smtpConfig.name,
      p_metric_type: 'send_time',
      p_metric_value: deliveryTime,
      p_threshold_value: 10000
    });

    return sendResult;
  } catch (err) {
    // Mask sensitive info in error log
    console.error(
      '[SMTP ERROR]',
      maskSMTPConfig(smtpConfig),
      troubleshootingGuide(err)
    );
    await supabase.from('smtp_delivery_confirmations').insert({
      email_id: null,
      recipient_email: emailRequest.to,
      provider_used: smtpConfig.name,
      delivery_status: 'failed',
      delivery_time_ms: null,
      error_message: err.message,
      provider_response: { error: err }
    });
    throw err;
  }
}