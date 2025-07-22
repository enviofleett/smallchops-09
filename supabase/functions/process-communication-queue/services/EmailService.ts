
import * as nodemailer from "npm:nodemailer@6.9.14";
import { CommunicationSettings, Order, EmailTemplate } from '../utils/types.ts';
import { CommunicationLogger } from './CommunicationLogger.ts';
import { TemplateRenderer } from './TemplateRenderer.ts';

export class EmailService {
  constructor(private settings: CommunicationSettings, private logger: CommunicationLogger) {}
  
  async send(event_id: string, order: Order, template: EmailTemplate, templateData: object) {
    const customerEmail = order.customer_email;

    if (!customerEmail) {
      const reason = `Skipping email for order ${order.order_number}: no customer_email found.`;
      console.log(reason);
      await this.logger.log({ event_id, order_id: order.id, channel: 'email', recipient: 'N/A', status: 'skipped', error_message: reason });
      return;
    }

    if (!(this.settings.smtp_host && this.settings.smtp_port && this.settings.smtp_user && this.settings.smtp_pass && this.settings.sender_email)) {
      const reason = 'SMTP settings are not fully configured. Skipping email sending.';
      console.log(reason);
      await this.logger.log({ event_id, order_id: order.id, channel: 'email', recipient: customerEmail, status: 'skipped', error_message: reason });
      return;
    }

    const subject = TemplateRenderer.render(template.subject, templateData);
    const body = TemplateRenderer.render(template.body, templateData);
    
    try {
      const transporter = nodemailer.createTransport({ host: this.settings.smtp_host, port: this.settings.smtp_port, secure: this.settings.smtp_port === 465, auth: { user: this.settings.smtp_user, pass: this.settings.smtp_pass } });
      const mailOptions = { from: `"${this.settings.name || 'Your Store'}" <${this.settings.sender_email}>`, to: customerEmail, subject, html: body };
      console.log(`Attempting to send email to ${customerEmail}...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${customerEmail}. Message ID: ${info.messageId}`);
      await this.logger.log({ event_id, order_id: order.id, channel: 'email', recipient: customerEmail, status: 'sent', template_name: template.name, subject, provider_response: info });
    } catch (emailError) {
      console.error(`Failed to send email to ${customerEmail}:`, emailError);
      await this.logger.log({ event_id, order_id: order.id, channel: 'email', recipient: customerEmail, status: 'failed', template_name: template.name, subject, error_message: emailError.message, provider_response: emailError });
    }
  }
}
