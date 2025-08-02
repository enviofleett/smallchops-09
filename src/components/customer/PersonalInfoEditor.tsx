import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Camera, Mail, Phone, Calendar, User, Save, Loader2 } from 'lucide-react';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { ImageUpload } from '@/components/ui/image-upload';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function PersonalInfoEditor() {
  const { customerAccount, user } = useCustomerAuth();
  const { profile, updateProfile, isUpdating } = useCustomerProfile();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || customerAccount?.name || '',
      phone: profile?.phone || customerAccount?.phone || '',
      date_of_birth: profile?.date_of_birth || customerAccount?.date_of_birth || '',
      bio: profile?.bio || '',
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    const updates: any = {
      ...data,
      date_of_birth: data.date_of_birth || null,
    };

    // Handle avatar upload if there's a new file
    if (avatarFile) {
      // In a real implementation, you'd upload to storage first
      // For now, we'll just proceed without the avatar update
    }

    updateProfile(updates);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {customerAccount?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2">
                <Button size="sm" variant="outline" className="w-8 h-8 rounded-full p-0">
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-medium">Profile Photo</h3>
              <p className="text-sm text-muted-foreground">
                Upload a photo to personalize your profile
              </p>
              <div className="flex items-center gap-2">
                <Badge variant={profile?.email_verified ? 'default' : 'secondary'}>
                  <Mail className="w-3 h-3 mr-1" />
                  {profile?.email_verified ? 'Email Verified' : 'Email Unverified'}
                </Badge>
                <Badge variant={profile?.phone_verified ? 'default' : 'secondary'}>
                  <Phone className="w-3 h-3 mr-1" />
                  {profile?.phone_verified ? 'Phone Verified' : 'Phone Unverified'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  className="mt-1"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...form.register('phone')}
                  className="mt-1"
                  placeholder="+234 xxx xxx xxxx"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-1 bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed from this page
                </p>
              </div>

              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  {...form.register('date_of_birth')}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                {...form.register('bio')}
                className="mt-1 resize-none"
                rows={3}
                placeholder="Tell us a bit about yourself..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                {form.watch('bio')?.length || 0}/500 characters
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}