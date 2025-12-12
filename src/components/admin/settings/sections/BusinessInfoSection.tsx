import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Globe, MessageCircle } from 'lucide-react';
import { BusinessSettingsFormData } from '../BusinessSettingsTab';

interface BusinessInfoSectionProps {
  form: UseFormReturn<BusinessSettingsFormData>;
}

export const BusinessInfoSection = ({ form }: BusinessInfoSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Business Information
        </CardTitle>
        <CardDescription>
          Core business details displayed across your website and customer communications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Name *</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Your Business Name"
                    className="bg-background"
                  />
                </FormControl>
                <FormDescription>
                  Your official business name
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Website URL
                </FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    value={field.value || ''}
                    placeholder="https://yourwebsite.com"
                    type="url"
                    className="bg-background"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="tagline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tagline</FormLabel>
              <FormControl>
                <Textarea 
                  {...field}
                  value={field.value || ''}
                  placeholder="Your compelling value proposition..."
                  className="bg-background resize-none"
                  rows={2}
                />
              </FormControl>
              <FormDescription>
                A short, memorable phrase that captures your brand essence
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="whatsapp_support_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp Support Number
              </FormLabel>
              <FormControl>
                <Input 
                  {...field}
                  value={field.value || ''}
                  placeholder="+234 800 000 0000"
                  className="bg-background"
                />
              </FormControl>
              <FormDescription>
                Include country code for WhatsApp chat support
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};
