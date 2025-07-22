
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrderStatus } from '@/types/orders';

const orderStatuses: OrderStatus[] = [
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

interface Template {
  id: string;
  name: string;
}

interface Trigger {
  enabled: boolean;
  email_template_id: string | null;
  sms_template_id: string | null;
}

interface TriggerManagerProps {
  triggers: Record<string, Trigger>;
  emailTemplates: Template[];
  smsTemplates: Template[];
  onTriggersChange: (triggers: Record<string, Trigger>) => void;
  loading: boolean;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

const TriggerManager: React.FC<TriggerManagerProps> = ({ 
  triggers, 
  emailTemplates, 
  smsTemplates, 
  onTriggersChange, 
  loading 
}) => {
  
  const handleTriggerChange = (status: OrderStatus, field: keyof Trigger, value: any) => {
    const updatedTriggers = { ...triggers };
    if (!updatedTriggers[status]) {
      updatedTriggers[status] = { enabled: false, email_template_id: null, sms_template_id: null };
    }
    (updatedTriggers[status] as any)[field] = value;
    onTriggersChange(updatedTriggers);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Communication Triggers</CardTitle>
        <p className="text-sm text-muted-foreground">
          Define which order status changes should automatically send notifications to customers.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {orderStatuses.map(status => {
          const trigger = triggers?.[status] || { enabled: false, email_template_id: null, sms_template_id: null };
          
          return (
            <div key={status} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-lg">{capitalize(status)}</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`enable-${status}`} className="text-sm">Enable Notification</Label>
                  <Switch
                    id={`enable-${status}`}
                    checked={trigger.enabled}
                    onCheckedChange={(checked) => handleTriggerChange(status, 'enabled', checked)}
                    disabled={loading}
                  />
                </div>
              </div>

              {trigger.enabled && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label htmlFor={`email-${status}`}>Email Template</Label>
                    <Select
                      value={trigger.email_template_id || 'none'}
                      onValueChange={(value) => handleTriggerChange(status, 'email_template_id', value === 'none' ? null : value)}
                      disabled={loading}
                    >
                      <SelectTrigger id={`email-${status}`}>
                        <SelectValue placeholder="Select email template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {emailTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`sms-${status}`}>SMS Template</Label>
                    <Select
                      value={trigger.sms_template_id || 'none'}
                      onValueChange={(value) => handleTriggerChange(status, 'sms_template_id', value === 'none' ? null : value)}
                      disabled={loading}
                    >
                      <SelectTrigger id={`sms-${status}`}>
                        <SelectValue placeholder="Select SMS template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {smsTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default TriggerManager;
