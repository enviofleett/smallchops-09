import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LogoUpload } from "./LogoUpload";
import { SocialMediaLinks } from "./SocialMediaLinks";
import { SEOSettings } from "./SEOSettings";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useErrorHandler } from "@/hooks/useErrorHandler";
const brandingSchema = z.object({
  name: z.string().min(1, "Business name is required"),
  tagline: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  website_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  logo_url: z.string().optional(),
  facebook_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  instagram_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  tiktok_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  twitter_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  linkedin_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  youtube_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  seo_keywords: z.string().optional()
});
type BrandingFormData = z.infer<typeof brandingSchema>;
export const BrandingTab = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    data: settings,
    invalidateSettings
  } = useBusinessSettings();
  const {
    handleError
  } = useErrorHandler();
  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      name: "",
      tagline: "",
      email: "",
      phone: "",
      address: "",
      website_url: "",
      logo_url: "",
      facebook_url: "",
      instagram_url: "",
      tiktok_url: "",
      twitter_url: "",
      linkedin_url: "",
      youtube_url: "",
      seo_title: "",
      seo_description: "",
      seo_keywords: ""
    }
  });

  // Update form when settings load or change
  useEffect(() => {
    if (settings) {
      form.reset({
        name: settings.name || "",
        tagline: settings.tagline || "",
        email: settings.email || "",
        phone: settings.phone || "",
        address: settings.address || "",
        website_url: settings.website_url || "",
        logo_url: settings.logo_url || "",
        facebook_url: settings.facebook_url || "",
        instagram_url: settings.instagram_url || "",
        tiktok_url: settings.tiktok_url || "",
        twitter_url: settings.twitter_url || "",
        linkedin_url: settings.linkedin_url || "",
        youtube_url: settings.youtube_url || "",
        seo_title: settings.seo_title || "",
        seo_description: settings.seo_description || "",
        seo_keywords: settings.seo_keywords || ""
      });
    }
  }, [settings, form]);
  const onSubmit = async (data: BrandingFormData) => {
    try {
      setIsSubmitting(true);
      console.log('Submitting branding data:', data);

      // Clean the data to ensure no undefined values
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, value]) => value !== undefined));
      console.log('Cleaned data being sent:', cleanData);

      // Use Supabase's functions.invoke method
      const {
        data: result,
        error
      } = await supabase.functions.invoke('business-settings', {
        body: cleanData,
        // Don't double-stringify, Supabase client handles this
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to update business settings');
      }
      console.log('Business settings updated successfully:', result);

      // Refresh the settings data
      await invalidateSettings();
      toast.success("Branding settings updated successfully!");
    } catch (error) {
      console.error('Error updating branding settings:', error);
      handleError(error, "Updating branding settings");
    } finally {
      setIsSubmitting(false);
    }
  };
  return <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Business Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Business Identity</CardTitle>
            
          </CardHeader>
          <CardContent className="space-y-6">
            <LogoUpload value={form.watch("logo_url")} onChange={url => form.setValue("logo_url", url)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({
              field
            }) => <FormItem>
                    <FormLabel>Business Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Business Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="tagline" render={({
              field
            }) => <FormItem>
                    <FormLabel>Tagline</FormLabel>
                    <FormControl>
                      <Input placeholder="Your business tagline" {...field} />
                    </FormControl>
                    <FormDescription>A short, catchy phrase about your business</FormDescription>
                    <FormMessage />
                  </FormItem>} />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>How customers can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({
              field
            }) => <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@business.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="phone" render={({
              field
            }) => <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="website_url" render={({
              field
            }) => <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.business.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="address" render={({
              field
            }) => <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="123 Business St, City, State 12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
            </div>
          </CardContent>
        </Card>

        {/* Social Media Links */}
        <SocialMediaLinks form={form} />

        {/* SEO Settings */}
        <SEOSettings form={form} />

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>;
};