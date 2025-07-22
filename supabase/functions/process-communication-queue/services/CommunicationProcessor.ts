
import { SupabaseAdminClient, CommunicationEvent, CommunicationSettings, CustomerCommunicationPreference, Order } from '../utils/types.ts';
import { CommunicationLogger } from './CommunicationLogger.ts';
import { CustomerPreferencesService } from './CustomerPreferencesService.ts';
import { EmailService } from './EmailService.ts';
import { EventQueueService } from './EventQueueService.ts';
import { OrderService } from './OrderService.ts';
import { SmsService } from './SmsService.ts';

export class CommunicationProcessor {
  private logger: CommunicationLogger;
  private customerPreferencesService: CustomerPreferencesService;
  private eventQueueService: EventQueueService;
  private orderService: OrderService;
  private emailService: EmailService;
  private smsService: SmsService;

  constructor(private supabaseAdmin: SupabaseAdminClient, private settings: CommunicationSettings) {
    this.logger = new CommunicationLogger(supabaseAdmin);
    this.customerPreferencesService = new CustomerPreferencesService(supabaseAdmin);
    this.eventQueueService = new EventQueueService(supabaseAdmin);
    this.orderService = new OrderService(supabaseAdmin);
    this.emailService = new EmailService(settings, this.logger);
    this.smsService = new SmsService(settings, this.logger);
  }

  public async processEvent(event: CommunicationEvent) {
    try {
      await this.eventQueueService.markAsProcessing(event.id);
      console.log(`Processing event ${event.id} for order ${event.order_id}`);

      const order = await this.orderService.getOrder(event.order_id);
      const preferences = await this.customerPreferencesService.getOrCreatePreferences(order.customer_email || '');

      if (preferences?.allow_order_updates === false) {
        const reason = 'Customer opted out of order updates.';
        console.log(reason, `Skipping event ${event.id}.`);
        if (order.customer_email) await this.logger.log({ event_id: event.id, order_id: order.id, channel: 'email', recipient: order.customer_email, status: 'skipped', error_message: reason });
        await this.eventQueueService.markAsSent(event.id, reason);
        return;
      }

      const newStatus = event.payload.new_status.toLowerCase();
      const trigger = this.settings.triggers?.[newStatus];

      if (!trigger?.enabled) {
        const reason = `Trigger for status '${newStatus}' is disabled or not configured.`;
        console.log(reason, `Skipping event ${event.id}.`);
        if (order.customer_email) await this.logger.log({ event_id: event.id, order_id: order.id, channel: 'email', recipient: order.customer_email, status: 'skipped', error_message: reason });
        if (order.customer_phone) await this.logger.log({ event_id: event.id, order_id: order.id, channel: 'sms', recipient: order.customer_phone, status: 'skipped', error_message: reason });
        await this.eventQueueService.markAsSent(event.id, reason);
        return;
      }

      const templateData = {
        customer_name: order.customer_name,
        order_number: order.order_number,
        total_amount: order.total_amount,
        shipping_address: order.delivery_address,
        new_status: event.payload.new_status,
        old_status: event.payload.old_status,
      };

      await this.handleEmail(event, order, preferences, trigger, templateData);
      await this.handleSms(event, order, preferences, trigger, templateData);

      await this.eventQueueService.markAsSent(event.id);
      console.log(`Successfully processed event ${event.id}`);
    } catch (processingError) {
      console.error(`Error processing event ${event.id}:`, processingError);
      await this.eventQueueService.handleProcessingError(event, processingError);
    }
  }
  
  private async handleEmail(event: CommunicationEvent, order: Order, preferences: CustomerCommunicationPreference | null, trigger: any, templateData: object) {
    if (!this.settings.enable_email || !trigger.email_template_id || !Array.isArray(this.settings.email_templates)) return;
    
    const canSendEmail = !preferences || ['email', 'any'].includes(preferences.preferred_channel);
    if (!canSendEmail) {
      const reason = `Skipping email: channel preference is '${preferences.preferred_channel}'.`;
      console.log(reason);
      if(order.customer_email) await this.logger.log({ event_id: event.id, order_id: order.id, channel: 'email', recipient: order.customer_email, status: 'skipped', error_message: reason });
      return;
    }
    
    const emailTemplate = this.settings.email_templates.find(t => t.id === trigger.email_template_id);
    if (emailTemplate) {
      await this.emailService.send(event.id, order, emailTemplate, templateData);
    } else {
      const reason = `No email template found with ID ${trigger.email_template_id}`;
      console.log(reason);
      if(order.customer_email) await this.logger.log({ event_id: event.id, order_id: order.id, channel: 'email', recipient: order.customer_email, status: 'skipped', error_message: reason });
    }
  }

  private async handleSms(event: CommunicationEvent, order: Order, preferences: CustomerCommunicationPreference | null, trigger: any, templateData: object) {
    if (!this.settings.enable_sms || !trigger.sms_template_id || !Array.isArray(this.settings.sms_templates)) return;

    const canSendSms = !preferences || ['sms', 'any'].includes(preferences.preferred_channel);
    if (!canSendSms) {
      const reason = `Skipping SMS: channel preference is '${preferences.preferred_channel}'.`;
      console.log(reason);
      if (order.customer_phone) await this.logger.log({ event_id: event.id, order_id: order.id, channel: 'sms', recipient: order.customer_phone, status: 'skipped', error_message: reason });
      return;
    }

    const smsTemplate = this.settings.sms_templates.find(t => t.id === trigger.sms_template_id);
    if (smsTemplate) {
      await this.smsService.send(event.id, order, smsTemplate, templateData);
    } else {
      const reason = `No SMS template found with ID ${trigger.sms_template_id}`;
      console.log(reason);
      if (order.customer_phone) await this.logger.log({ event_id: event.id, order_id: order.id, channel: 'sms', recipient: order.customer_phone, status: 'skipped', error_message: reason });
    }
  }
}
