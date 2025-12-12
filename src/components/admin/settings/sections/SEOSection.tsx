import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, AlertCircle } from 'lucide-react';
import { BusinessSettingsFormData } from '../BusinessSettingsTab';

interface SEOSectionProps {
  form: UseFormReturn<BusinessSettingsFormData>;
}

export const SEOSection = ({ form }: SEOSectionProps) => {
  const seoTitle = form.watch('seo_title') || '';
  const seoDescription = form.watch('seo_description') || '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          SEO Settings
        </CardTitle>
        <CardDescription>
          Optimize your website for search engines. These settings affect how your site appears in Google results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="seo_title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SEO Title</FormLabel>
              <FormControl>
                <Input 
                  {...field}
                  value={field.value || ''}
                  placeholder="Your Business - Main Keyword | Location"
                  maxLength={60}
                  className="bg-background"
                />
              </FormControl>
              <FormDescription className="flex items-center justify-between">
                <span>Title displayed in search results</span>
                <span className={seoTitle.length > 50 ? 'text-destructive' : 'text-muted-foreground'}>
                  {seoTitle.length}/60
                </span>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="seo_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meta Description</FormLabel>
              <FormControl>
                <Textarea 
                  {...field}
                  value={field.value || ''}
                  placeholder="A compelling description of your business that encourages clicks from search results..."
                  maxLength={160}
                  className="bg-background resize-none"
                  rows={3}
                />
              </FormControl>
              <FormDescription className="flex items-center justify-between">
                <span>Description shown in search results</span>
                <span className={seoDescription.length > 150 ? 'text-destructive' : 'text-muted-foreground'}>
                  {seoDescription.length}/160
                </span>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="seo_keywords"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SEO Keywords</FormLabel>
              <FormControl>
                <Input 
                  {...field}
                  value={field.value || ''}
                  placeholder="keyword1, keyword2, keyword3"
                  className="bg-background"
                />
              </FormControl>
              <FormDescription>
                Comma-separated keywords relevant to your business
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* SEO Preview */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Search Preview
          </div>
          <div className="space-y-1">
            <p className="text-lg text-primary hover:underline cursor-pointer truncate">
              {seoTitle || 'Your Business Name - Add SEO Title'}
            </p>
            <p className="text-sm text-green-600 truncate">
              {form.watch('website_url') || 'https://yourwebsite.com'}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {seoDescription || 'Add a compelling meta description to improve click-through rates from search results.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
