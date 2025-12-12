import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Share2, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
import { BusinessSettingsFormData } from '../BusinessSettingsTab';

interface SocialMediaSectionProps {
  form: UseFormReturn<BusinessSettingsFormData>;
}

// TikTok icon component
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const socialPlatforms = [
  {
    name: 'facebook_url',
    label: 'Facebook',
    placeholder: 'https://facebook.com/yourbusiness',
    icon: Facebook,
  },
  {
    name: 'instagram_url',
    label: 'Instagram',
    placeholder: 'https://instagram.com/yourbusiness',
    icon: Instagram,
  },
  {
    name: 'tiktok_url',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@yourbusiness',
    icon: TikTokIcon,
  },
  {
    name: 'twitter_url',
    label: 'Twitter/X',
    placeholder: 'https://twitter.com/yourbusiness',
    icon: Twitter,
  },
  {
    name: 'linkedin_url',
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/company/yourbusiness',
    icon: Linkedin,
  },
  {
    name: 'youtube_url',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@yourbusiness',
    icon: Youtube,
  },
] as const;

export const SocialMediaSection = ({ form }: SocialMediaSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Social Media Links
        </CardTitle>
        <CardDescription>
          Connect your social media profiles to display on your website footer and contact pages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {socialPlatforms.map((platform) => (
            <FormField
              key={platform.name}
              control={form.control}
              name={platform.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <platform.icon className="h-4 w-4" />
                    {platform.label}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field}
                      value={field.value || ''}
                      placeholder={platform.placeholder}
                      type="url"
                      className="bg-background"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
