
import { CommunicationSettings, Order, SmsTemplate } from '../utils/types.ts';
import { CommunicationLogger } from './CommunicationLogger.ts';
import { TemplateRenderer } from './TemplateRenderer.ts';

export class SmsService {
  constructor(private settings: CommunicationSettings, private logger: CommunicationLogger) {}

  async send(event_id: string, order: Order, template: SmsTemplate, templateData: object) {
    const customerPhone = order.customer_phone;
    if (!customerPhone) {
      const reason = `Skipping SMS for order ${order.order_number}: no customer_phone found.`;
      console.log(reason);
      await this.logger.log({
        event_id,
        order_id: order.id,
        channel: 'sms',
        recipient: 'N/A',
        status: 'skipped',
        error_message: reason,
      });
      return;
    }

    const body = TemplateRenderer.render(template.body, templateData);

    // Only attempt to send if enable_sms is true
    if (this.settings.enable_sms && this.settings.sms_provider?.toLowerCase().includes("mysmstab")) {
      const apiUrl = "https://mysmstab.com/api/sms/";
      // Gather configs from settings accordingly
      const apiKey = this.settings.sms_api_key;
      const senderId = this.settings.sms_sender_id || "YourSender";
      // Optionally support additional fields later

      if (!apiKey || !senderId) {
        const reason = `SMS not sent: MySmstab config missing (api_key or sender_id)`;
        console.log(reason);
        await this.logger.log({
          event_id,
          order_id: order.id,
          channel: 'sms',
          recipient: customerPhone,
          status: 'skipped',
          error_message: reason,
        });
        return;
      }

      const payload = {
        api_key: apiKey,
        sender_id: senderId,
        phone: customerPhone,
        message: body,
      };

      let provider_response: any = null;
      let error_message: string | undefined = undefined;

      try {
        const resp = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        provider_response = await resp.json();
        if (
          (provider_response.status && provider_response.status === "success") ||
          (provider_response.error === false) // fallback
        ) {
          // SMS sent successfully
          console.log(`SMS sent to ${customerPhone} via MySmstab: ${JSON.stringify(provider_response)}`);
          await this.logger.log({
            event_id,
            order_id: order.id,
            channel: 'sms',
            recipient: customerPhone,
            status: 'sent',
            template_name: template.name,
            provider_response,
          });
          return;
        } else {
          // MySmstab sometimes returns error message directly
          error_message = provider_response.message || "Failed to send SMS via MySmstab";
          console.error(`SMS sending to ${customerPhone} failed:`, provider_response);
        }
      } catch (err: any) {
        error_message = err?.message || String(err);
        console.error(`Error sending SMS via MySmstab:`, error_message);
      }

      // If error, log as failed
      await this.logger.log({
        event_id,
        order_id: order.id,
        channel: 'sms',
        recipient: customerPhone,
        status: 'failed',
        template_name: template.name,
        provider_response,
        error_message,
      });

      return;
    }

    // If not MySmstab or not enabled, fallback to simulation (was default)
    console.log(`--- Would send SMS to ${customerPhone}. Body: ${body} ---`);
    await this.logger.log({
      event_id,
      order_id: order.id,
      channel: 'sms',
      recipient: customerPhone,
      status: 'sent',
      template_name: template.name,
      provider_response: { message: 'SMS sending simulated.' },
    });
  }
}
