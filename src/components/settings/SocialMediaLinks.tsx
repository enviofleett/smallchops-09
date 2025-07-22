import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Facebook, Instagram, Twitter, Linkedin, Youtube } from "lucide-react";

interface SocialMediaLinksProps {
  form: UseFormReturn<any>;
}

export const SocialMediaLinks = ({ form }: SocialMediaLinksProps) => {
  const socialPlatforms = [
    {
      name: "facebook_url",
      label: "Facebook",
      placeholder: "https://facebook.com/yourpage",
      icon: Facebook,
    },
    {
      name: "instagram_url", 
      label: "Instagram",
      placeholder: "https://instagram.com/yourprofile",
      icon: Instagram,
    },
    {
      name: "twitter_url",
      label: "Twitter/X", 
      placeholder: "https://twitter.com/yourhandle",
      icon: Twitter,
    },
    {
      name: "linkedin_url",
      label: "LinkedIn",
      placeholder: "https://linkedin.com/company/yourcompany", 
      icon: Linkedin,
    },
    {
      name: "youtube_url",
      label: "YouTube",
      placeholder: "https://youtube.com/@yourchannel",
      icon: Youtube,
    },
    {
      name: "tiktok_url",
      label: "TikTok", 
      placeholder: "https://tiktok.com/@yourhandle",
      icon: () => (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media Links</CardTitle>
        <CardDescription>Connect your social media accounts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {socialPlatforms.map((platform) => {
            const IconComponent = platform.icon;
            return (
              <FormField
                key={platform.name}
                control={form.control}
                name={platform.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4" />
                      {platform.label}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={platform.placeholder} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};