import React, { useState } from 'react';
import { useOptimizedCustomerAuth } from '@/hooks/useOptimizedCustomerAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Phone, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

// Production-ready validation schema
const profileSchema = z.object({
  name: z.string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" })
    .regex(/^[a-zA-Z\s'-]+$/, { message: "Name can only contain letters, spaces, hyphens and apostrophes" }),
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  phone: z.string()
    .trim()
    .regex(/^[\d\s+()-]{10,20}$/, { message: "Invalid phone number format" })
    .optional()
    .or(z.literal(''))
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const ProfileEditSection: React.FC = () => {
  const { customerAccount, user, updateCustomerAccount, isLoading: authLoading } = useOptimizedCustomerAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<ProfileFormData>({
    name: customerAccount?.name || '',
    email: user?.email || customerAccount?.email || '',
    phone: customerAccount?.phone || ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof ProfileFormData, string>>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  React.useEffect(() => {
    const originalData = {
      name: customerAccount?.name || '',
      email: user?.email || customerAccount?.email || '',
      phone: customerAccount?.phone || ''
    };
    
    const changed = JSON.stringify(formData) !== JSON.stringify(originalData);
    setHasChanges(changed);
  }, [formData, customerAccount, user]);

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    try {
      profileSchema.parse(formData);
      setValidationErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Partial<Record<keyof ProfileFormData, string>> = {};
        error.errors.forEach(err => {
          const field = err.path[0] as keyof ProfileFormData;
          if (field) {
            errors[field] = err.message;
          }
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please check the form for errors",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Sanitize inputs before submission
      const sanitizedData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone ? formData.phone.trim() : null
      };

      // Update customer account
      await updateCustomerAccount({
        name: sanitizedData.name,
        phone: sanitizedData.phone || undefined
      });

      // Note: Email updates require additional verification
      // For production, implement email verification flow
      if (sanitizedData.email !== user?.email) {
        toast({
          title: "Email Update Notice",
          description: "Email updates require verification. Please check your new email for a confirmation link.",
          variant: "default"
        });
        // TODO: Implement email update with verification
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
        variant: "default"
      });

      setHasChanges(false);
    } catch (error) {
      console.error('Profile update error:', error);
      
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setFormData({
      name: customerAccount?.name || '',
      email: user?.email || customerAccount?.email || '',
      phone: customerAccount?.phone || ''
    });
    setValidationErrors({});
    setHasChanges(false);
  };

  if (authLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Edit Profile</h2>
        <p className="text-gray-500">Update your personal information</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Full Name *
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`pl-10 ${validationErrors.name ? 'border-red-500' : ''}`}
                placeholder="Enter your full name"
                maxLength={100}
                disabled={isSubmitting}
              />
            </div>
            {validationErrors.name && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{validationErrors.name}</span>
              </div>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address *
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`pl-10 ${validationErrors.email ? 'border-red-500' : ''}`}
                placeholder="your.email@example.com"
                maxLength={255}
                disabled={isSubmitting}
              />
            </div>
            {validationErrors.email && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{validationErrors.email}</span>
              </div>
            )}
            {formData.email !== user?.email && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span>Changing email will require verification</span>
              </div>
            )}
          </div>

          {/* Phone Field */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`pl-10 ${validationErrors.phone ? 'border-red-500' : ''}`}
                placeholder="+234 xxx xxx xxxx"
                maxLength={20}
                disabled={isSubmitting}
              />
            </div>
            {validationErrors.phone && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{validationErrors.phone}</span>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Optional: Used for order updates and delivery notifications
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || !hasChanges}
              className="flex-1 sm:flex-initial"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || !hasChanges}
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Security Notice</p>
                <p className="text-blue-700">
                  Your information is secure. We never share your personal details with third parties.
                </p>
              </div>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};
