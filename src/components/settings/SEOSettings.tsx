import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";

interface SEOSettingsProps {
  form: UseFormReturn<any>;
}

export const SEOSettings = ({ form }: SEOSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          SEO Settings
        </CardTitle>
        <CardDescription>
          Optimize your website for search engines and social media
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="seo_title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SEO Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Your Business Name - Professional Service Provider" 
                  {...field} 
                  maxLength={60}
                />
              </FormControl>
              <FormDescription>
                Appears as the clickable headline in search results (50-60 characters recommended)
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
              <FormLabel>SEO Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Brief description of your business and what makes you unique. This appears in search results under your title."
                  {...field}
                  maxLength={160}
                  rows={3}
                />
              </FormControl>
              <FormDescription>
                Brief summary that appears in search results (150-160 characters recommended)
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
                  placeholder="keyword1, keyword2, keyword3, business type, location"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Comma-separated keywords that describe your business (focus on 3-5 main keywords)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
};