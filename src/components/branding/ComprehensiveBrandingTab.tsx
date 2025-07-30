import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { EnhancedLogoUpload } from './EnhancedLogoUpload';
import { BrandingAnalytics } from './BrandingAnalytics';
import { 
  Palette, 
  FileImage, 
  BarChart3, 
  Settings,
  Save,
  Loader2,
  Eye,
  Download
} from 'lucide-react';

const brandingSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  tagline: z.string().optional(),
  logo_url: z.string().optional(),
  logo_alt_text: z.string().optional(),
  logo_dark_url: z.string().optional(),
  primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format').optional(),
  secondary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format').optional(),
  accent_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format').optional(),
  favicon_url: z.string().optional(),
  social_card_url: z.string().optional(),
  brand_guidelines: z.string().optional(),
  logo_usage_rules: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  facebook_url: z.string().url().optional().or(z.literal('')),
  instagram_url: z.string().url().optional().or(z.literal('')),
  tiktok_url: z.string().url().optional().or(z.literal('')),
  twitter_url: z.string().url().optional().or(z.literal('')),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  youtube_url: z.string().url().optional().or(z.literal('')),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  seo_keywords: z.string().optional(),
});

type BrandingFormData = z.infer<typeof brandingSchema>;

export const ComprehensiveBrandingTab = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { data: settings, invalidateSettings } = useBusinessSettings();

  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      name: '',
      tagline: '',
      logo_url: '',
      logo_alt_text: '',
      logo_dark_url: '',
      primary_color: '#3b82f6',
      secondary_color: '#1e40af',
      accent_color: '#f59e0b',
      favicon_url: '',
      social_card_url: '',
      brand_guidelines: '',
      logo_usage_rules: '',
      email: '',
      phone: '',
      address: '',
      website_url: '',
      facebook_url: '',
      instagram_url: '',
      tiktok_url: '',
      twitter_url: '',
      linkedin_url: '',
      youtube_url: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
    },
  });

  // Load existing settings into form
  useState(() => {
    if (settings) {
      form.reset({
        name: settings.name || '',
        tagline: settings.tagline || '',
        logo_url: settings.logo_url || '',
        logo_alt_text: settings.logo_alt_text || '',
        logo_dark_url: settings.logo_dark_url || '',
        primary_color: settings.primary_color || '#3b82f6',
        secondary_color: settings.secondary_color || '#1e40af',
        accent_color: settings.accent_color || '#f59e0b',
        favicon_url: settings.favicon_url || '',
        social_card_url: settings.social_card_url || '',
        brand_guidelines: settings.brand_guidelines || '',
        logo_usage_rules: settings.logo_usage_rules || '',
        email: settings.email || '',
        phone: settings.phone || '',
        address: settings.address || '',
        website_url: settings.website_url || '',
        facebook_url: settings.facebook_url || '',
        instagram_url: settings.instagram_url || '',
        tiktok_url: settings.tiktok_url || '',
        twitter_url: settings.twitter_url || '',
        linkedin_url: settings.linkedin_url || '',
        youtube_url: settings.youtube_url || '',
        seo_title: settings.seo_title || '',
        seo_description: settings.seo_description || '',
        seo_keywords: settings.seo_keywords || '',
      });
    }
  });

  const onSubmit = async (data: BrandingFormData) => {
    try {
      setIsSubmitting(true);

      // Clean undefined values
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined && value !== '')
      );

      const { data: result, error } = await supabase.functions.invoke('business-settings', {
        method: 'POST',
        body: cleanedData,
      });

      if (error) {
        throw error;
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to update branding settings');
      }

      toast.success('Branding settings updated successfully!');
      await invalidateSettings();
    } catch (error: any) {
      console.error('Error updating branding settings:', error);
      toast.error('Failed to update settings', {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportBrandKit = () => {
    // Generate a simple brand kit export
    const brandData = {
      business: {
        name: form.getValues('name'),
        tagline: form.getValues('tagline'),
        website: form.getValues('website_url'),
      },
      colors: {
        primary: form.getValues('primary_color'),
        secondary: form.getValues('secondary_color'),
        accent: form.getValues('accent_color'),
      },
      assets: {
        logo: form.getValues('logo_url'),
        logoDark: form.getValues('logo_dark_url'),
        favicon: form.getValues('favicon_url'),
        socialCard: form.getValues('social_card_url'),
      },
      guidelines: form.getValues('brand_guidelines'),
      exportDate: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(brandData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${form.getValues('name')?.replace(/\s+/g, '-').toLowerCase() || 'brand'}-kit.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast.success('Brand kit exported successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brand Management</h1>
          <p className="text-muted-foreground">
            Manage your complete brand identity and monitor consistency across all touchpoints.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {previewMode ? 'Edit Mode' : 'Preview'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportBrandKit}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Brand Kit
          </Button>
        </div>
      </div>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="identity" className="flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            Brand Identity
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Colors & Assets
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="guidelines" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Guidelines
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <TabsContent value="identity" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Primary Logo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="logo_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <EnhancedLogoUpload
                              value={field.value}
                              onChange={field.onChange}
                              disabled={previewMode}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Business Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={previewMode} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tagline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tagline</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={previewMode} placeholder="Your compelling value proposition" />
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
                        name="logo_alt_text"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logo Alt Text</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={previewMode} placeholder="Company Logo" />
                            </FormControl>
                            <FormDescription>
                              Accessibility description for your logo
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="colors" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Brand Colors</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="primary_color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary</FormLabel>
                            <div className="space-y-2">
                              <FormControl>
                                <Input type="color" {...field} disabled={previewMode} className="h-10" />
                              </FormControl>
                              <FormControl>
                                <Input {...field} disabled={previewMode} placeholder="#3b82f6" />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="secondary_color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary</FormLabel>
                            <div className="space-y-2">
                              <FormControl>
                                <Input type="color" {...field} disabled={previewMode} className="h-10" />
                              </FormControl>
                              <FormControl>
                                <Input {...field} disabled={previewMode} placeholder="#1e40af" />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="accent_color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Accent</FormLabel>
                            <div className="space-y-2">
                              <FormControl>
                                <Input type="color" {...field} disabled={previewMode} className="h-10" />
                              </FormControl>
                              <FormControl>
                                <Input {...field} disabled={previewMode} placeholder="#f59e0b" />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Color Preview */}
                    <div className="mt-6 p-4 rounded-lg border">
                      <h4 className="font-medium mb-3">Color Preview</h4>
                      <div className="flex gap-2">
                        <div 
                          className="w-16 h-16 rounded-lg shadow-sm border"
                          style={{ backgroundColor: form.watch('primary_color') }}
                          title="Primary Color"
                        />
                        <div 
                          className="w-16 h-16 rounded-lg shadow-sm border"
                          style={{ backgroundColor: form.watch('secondary_color') }}
                          title="Secondary Color"
                        />
                        <div 
                          className="w-16 h-16 rounded-lg shadow-sm border"
                          style={{ backgroundColor: form.watch('accent_color') }}
                          title="Accent Color"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Additional Assets</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="logo_dark_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dark Mode Logo URL</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={previewMode} placeholder="https://..." />
                          </FormControl>
                          <FormDescription>
                            Alternative logo for dark backgrounds
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="favicon_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Favicon URL</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={previewMode} placeholder="https://..." />
                          </FormControl>
                          <FormDescription>
                            Browser tab icon (32x32px recommended)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="social_card_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Social Media Card Image</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={previewMode} placeholder="https://..." />
                          </FormControl>
                          <FormDescription>
                            Image for social media sharing (1200x630px)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <BrandingAnalytics />
            </TabsContent>

            <TabsContent value="guidelines" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="brand_guidelines"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>General Brand Guidelines</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            disabled={previewMode}
                            placeholder="Describe your brand personality, tone of voice, and key messaging guidelines..."
                            className="min-h-[120px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Define how your brand should be represented and communicated
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logo_usage_rules"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo Usage Rules</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            disabled={previewMode}
                            placeholder="Specify minimum sizes, clear space requirements, acceptable backgrounds, and what NOT to do with your logo..."
                            className="min-h-[120px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Specific guidelines for logo placement and usage
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {!previewMode && (
              <div className="flex justify-end gap-4 pt-6 border-t">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Branding Settings
                </Button>
              </div>
            )}
          </form>
        </Form>
      </Tabs>
    </div>
  );
};