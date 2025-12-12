import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { 
  Save,
  Loader2,
  Building2,
  Share2,
  Search,
  Clock,
  Palette,
  CalendarX
} from 'lucide-react';
import { BusinessInfoSection } from './sections/BusinessInfoSection';
import { SocialMediaSection } from './sections/SocialMediaSection';
import { SEOSection } from './sections/SEOSection';
import { BusinessHoursSection } from './sections/BusinessHoursSection';
import { BrandColorsSection } from './sections/BrandColorsSection';
import { DisabledDatesSection } from './sections/DisabledDatesSection';

const businessSettingsSchema = z.object({
  // Business Info
  name: z.string().min(1, 'Business name is required'),
  tagline: z.string().optional().nullable(),
  website_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  whatsapp_support_number: z.string().optional().nullable(),
  
  // Social Media
  facebook_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  instagram_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  tiktok_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  twitter_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  youtube_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  
  // SEO
  seo_title: z.string().max(60, 'SEO title should be under 60 characters').optional().nullable(),
  seo_description: z.string().max(160, 'SEO description should be under 160 characters').optional().nullable(),
  seo_keywords: z.string().optional().nullable(),
  
  // Brand Colors
  primary_color: z.string().optional().nullable(),
  secondary_color: z.string().optional().nullable(),
  accent_color: z.string().optional().nullable(),
  
  // Business Hours
  business_hours: z.object({
    monday: z.object({ open: z.string(), close: z.string(), is_open: z.boolean() }),
    tuesday: z.object({ open: z.string(), close: z.string(), is_open: z.boolean() }),
    wednesday: z.object({ open: z.string(), close: z.string(), is_open: z.boolean() }),
    thursday: z.object({ open: z.string(), close: z.string(), is_open: z.boolean() }),
    friday: z.object({ open: z.string(), close: z.string(), is_open: z.boolean() }),
    saturday: z.object({ open: z.string(), close: z.string(), is_open: z.boolean() }),
    sunday: z.object({ open: z.string(), close: z.string(), is_open: z.boolean() }),
  }).optional().nullable(),
  
  // Disabled Dates
  disabled_calendar_dates: z.array(z.string()).optional().nullable(),
});

export type BusinessSettingsFormData = z.infer<typeof businessSettingsSchema>;

const defaultBusinessHours = {
  monday: { open: '08:00', close: '19:00', is_open: true },
  tuesday: { open: '08:00', close: '19:00', is_open: true },
  wednesday: { open: '08:00', close: '19:00', is_open: true },
  thursday: { open: '08:00', close: '19:00', is_open: true },
  friday: { open: '08:00', close: '19:00', is_open: true },
  saturday: { open: '08:00', close: '19:00', is_open: true },
  sunday: { open: '10:00', close: '16:00', is_open: true },
};

export const BusinessSettingsTab = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const { data: settings, invalidateSettings, isLoading } = useBusinessSettings();

  const form = useForm<BusinessSettingsFormData>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      name: '',
      tagline: '',
      website_url: '',
      whatsapp_support_number: '',
      facebook_url: '',
      instagram_url: '',
      tiktok_url: '',
      twitter_url: '',
      linkedin_url: '',
      youtube_url: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      primary_color: '#3b82f6',
      secondary_color: '#1e40af',
      accent_color: '#f59e0b',
      business_hours: defaultBusinessHours,
      disabled_calendar_dates: [],
    },
  });

  // Load existing settings into form
  useEffect(() => {
    if (settings) {
      form.reset({
        name: settings.name || '',
        tagline: settings.tagline || '',
        website_url: settings.website_url || '',
        whatsapp_support_number: settings.whatsapp_support_number || '',
        facebook_url: settings.facebook_url || '',
        instagram_url: settings.instagram_url || '',
        tiktok_url: settings.tiktok_url || '',
        twitter_url: settings.twitter_url || '',
        linkedin_url: settings.linkedin_url || '',
        youtube_url: settings.youtube_url || '',
        seo_title: settings.seo_title || '',
        seo_description: settings.seo_description || '',
        seo_keywords: settings.seo_keywords || '',
        primary_color: settings.primary_color || '#3b82f6',
        secondary_color: settings.secondary_color || '#1e40af',
        accent_color: settings.accent_color || '#f59e0b',
        business_hours: settings.business_hours || defaultBusinessHours,
        disabled_calendar_dates: settings.disabled_calendar_dates || [],
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: BusinessSettingsFormData) => {
    try {
      setIsSubmitting(true);

      // Clean empty strings to null for proper database storage
      const cleanedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === '' ? null : value
        ])
      );

      const response = await supabase.functions.invoke('business-settings', {
        body: cleanedData,
      });

      // Handle Supabase function invoke response structure
      if (response.error) {
        throw new Error(response.error.message || 'Failed to update business settings');
      }

      // The edge function returns { data: {...} } on success or { error: "..." } on failure
      const result = response.data;
      
      if (result?.error) {
        throw new Error(result.error);
      }

      if (!result?.data) {
        throw new Error('Invalid response from server');
      }

      toast.success('Business settings updated successfully!');
      await invalidateSettings();
    } catch (error: any) {
      console.error('Error updating business settings:', error);
      toast.error('Failed to update settings', {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Business Settings</h2>
            <p className="text-sm text-muted-foreground">
              Configure your business information, social media, SEO, and more.
            </p>
          </div>
          <Button type="submit" disabled={isSubmitting} className="gap-2 shrink-0">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto pb-2 -mx-4 px-4">
            <TabsList className="grid w-full min-w-[600px] grid-cols-6 h-auto p-1">
              <TabsTrigger value="info" className="flex items-center gap-1.5 text-xs px-2 py-2">
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Business</span>
              </TabsTrigger>
              <TabsTrigger value="social" className="flex items-center gap-1.5 text-xs px-2 py-2">
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Social</span>
              </TabsTrigger>
              <TabsTrigger value="seo" className="flex items-center gap-1.5 text-xs px-2 py-2">
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">SEO</span>
              </TabsTrigger>
              <TabsTrigger value="hours" className="flex items-center gap-1.5 text-xs px-2 py-2">
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hours</span>
              </TabsTrigger>
              <TabsTrigger value="colors" className="flex items-center gap-1.5 text-xs px-2 py-2">
                <Palette className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Colors</span>
              </TabsTrigger>
              <TabsTrigger value="dates" className="flex items-center gap-1.5 text-xs px-2 py-2">
                <CalendarX className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Closures</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="info" className="space-y-4">
            <BusinessInfoSection form={form} />
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <SocialMediaSection form={form} />
          </TabsContent>

          <TabsContent value="seo" className="space-y-4">
            <SEOSection form={form} />
          </TabsContent>

          <TabsContent value="hours" className="space-y-4">
            <BusinessHoursSection form={form} />
          </TabsContent>

          <TabsContent value="colors" className="space-y-4">
            <BrandColorsSection form={form} />
          </TabsContent>

          <TabsContent value="dates" className="space-y-4">
            <DisabledDatesSection form={form} />
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
};
