import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const EmailTemplateTester: React.FC = () => {
  const { toast } = useToast();
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testVariables, setTestVariables] = useState('{}');

  const { data: templates } = useQuery({
    queryKey: ['active-email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('id, template_key, template_name')
        .eq('is_active', true)
        .order('template_name');
      if (error) throw error;
      return data;
    }
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      let variables;
      try {
        variables = JSON.parse(testVariables);
      } catch {
        throw new Error('Invalid JSON format for variables');
      }

      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          templateKey: selectedTemplateKey,
          variables,
          emailType: 'transactional'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Test Email Sent',
        description: `Test email sent successfully to ${testEmail}`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSendTest = () => {
    if (!testEmail || !selectedTemplateKey) {
      toast({
        title: 'Missing Information',
        description: 'Please select a template and enter a test email address',
        variant: 'destructive'
      });
      return;
    }

    sendTestMutation.mutate();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This will send a real email to the specified address using your production email configuration.
          Make sure to use valid test variables that match your template.
        </AlertDescription>
      </Alert>

      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Test Email Delivery</h3>
          <p className="text-sm text-muted-foreground">
            Send test emails to verify your templates and email configuration in production
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="template">Select Template *</Label>
          <select
            id="template"
            value={selectedTemplateKey}
            onChange={(e) => setSelectedTemplateKey(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Choose a template...</option>
            {templates?.map((template) => (
              <option key={template.id} value={template.template_key}>
                {template.template_name} ({template.template_key})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-email">Test Email Address *</Label>
          <Input
            id="test-email"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="variables">Template Variables (JSON)</Label>
          <Textarea
            id="variables"
            value={testVariables}
            onChange={(e) => setTestVariables(e.target.value)}
            placeholder='{"customer_name": "John Doe", "order_number": "ORD-12345", "total_amount": 5000}'
            className="font-mono text-sm min-h-[150px]"
          />
          <p className="text-xs text-muted-foreground">
            Enter a JSON object with variables used in your template
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSendTest}
            disabled={sendTestMutation.isPending || !selectedTemplateKey || !testEmail}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendTestMutation.isPending ? 'Sending...' : 'Send Test Email'}
          </Button>
        </div>

        {sendTestMutation.isSuccess && (
          <Alert>
            <AlertDescription className="text-green-600">
              ✓ Test email sent successfully! Check your inbox at {testEmail}
            </AlertDescription>
          </Alert>
        )}
      </Card>

      <Card className="p-6 bg-muted/50">
        <h4 className="font-semibold mb-3">Common Template Variables</h4>
        <div className="space-y-2 text-sm">
          <p><code className="bg-background px-2 py-1 rounded">{`{{customer_name}}`}</code> - Customer's name</p>
          <p><code className="bg-background px-2 py-1 rounded">{`{{order_number}}`}</code> - Order number</p>
          <p><code className="bg-background px-2 py-1 rounded">{`{{total_amount}}`}</code> - Order total amount</p>
          <p><code className="bg-background px-2 py-1 rounded">{`{{status}}`}</code> - Order status</p>
          <p><code className="bg-background px-2 py-1 rounded">{`{{delivery_date}}`}</code> - Delivery date</p>
        </div>
      </Card>
    </div>
  );
};
