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
      if (!testEmail || !selectedTemplateKey) {
        throw new Error('Please select a template and enter a test email address');
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(testEmail)) {
        throw new Error('Please enter a valid email address');
      }

      let variables;
      try {
        variables = JSON.parse(testVariables);
      } catch {
        throw new Error('Invalid JSON format for variables. Please check your syntax.');
      }

      console.log('🔍 Sending test email:', {
        to: testEmail,
        templateKey: selectedTemplateKey,
        hasVariables: Object.keys(variables).length > 0
      });

      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: testEmail,
          templateKey: selectedTemplateKey,
          variables,
          emailType: 'transactional'
        }
      });

      if (error) {
        console.error('❌ Test email error:', error);
        throw new Error(error.message || 'Failed to send test email. Check edge function logs.');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Email send failed');
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Test email sent successfully:', data);
      toast({
        title: '✅ Test email sent successfully',
        description: `Email delivered to ${testEmail}. Check your inbox.`,
      });
      setTestEmail('');
      setTestVariables('{}');
    },
    onError: (error: any) => {
      console.error('❌ Test email mutation error:', error);
      
      let errorMessage = error.message;
      let errorTitle = 'Failed to send test email';
      
      // Provide specific error guidance
      if (error.message.includes('CORS')) {
        errorMessage = 'CORS error: Edge function may be starting up. Please wait 30 seconds and try again.';
      } else if (error.message.includes('535') || error.message.includes('authentication')) {
        errorTitle = 'SMTP Authentication Failed';
        errorMessage = 'Invalid SMTP credentials. Check your Function Secrets in Supabase Dashboard.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Check your SMTP server settings and network connection.';
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
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
      <Alert className="border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>⚠️ Production Email Test</strong>
          <p className="mt-1">This will send a REAL email to the specified address using your production SMTP settings.</p>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
            <li>Email will be delivered to the recipient's inbox</li>
            <li>Use a test email address you control</li>
            <li>Check spam folder if email doesn't arrive</li>
            <li>Verify your SMTP credentials are configured correctly</li>
          </ul>
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
            className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendTestMutation.isPending ? (
              <>
                <span>Sending</span>
                <span className="animate-pulse ml-1">...</span>
              </>
            ) : (
              'Send Test Email'
            )}
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
