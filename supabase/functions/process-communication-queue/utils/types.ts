
// These types should be kept in sync with your database schema.
export interface CommunicationEvent {
  id: string;
  order_id: string;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  retry_count: number;
  payload: {
    new_status: string;
    old_status: string;
  };
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  total_amount: number;
  delivery_address: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
}

export interface Trigger {
  enabled: boolean;
  email_template_id: string | null;
  sms_template_id: string | null;
}

export interface CommunicationSettings {
  id: string;
  enable_email: boolean;
  enable_sms: boolean;
  sender_email: string;
  name?: string; // Business name
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  triggers: Record<string, Trigger>;
  email_templates: EmailTemplate[];
  sms_templates: SmsTemplate[];
}

export interface CustomerCommunicationPreference {
  id: string;
  customer_email: string;
  allow_order_updates: boolean;
  allow_promotions: boolean;
  preferred_channel: 'email' | 'sms' | 'any';
  language: string;
}

export interface CommunicationLogData {
  event_id: string;
  order_id: string;
  channel: 'email' | 'sms';
  recipient: string;
  status: 'sent' | 'failed' | 'skipped';
  template_name?: string;
  subject?: string;
  provider_response?: object;
  error_message?: string;
}

export type SupabaseAdminClient = any;
