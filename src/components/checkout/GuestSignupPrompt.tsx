import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Gift, Clock, Star, Mail, Lock, X } from 'lucide-react';
import { useGuestSession } from '@/hooks/useGuestSession';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GuestSignupPromptProps {
  isOpen: boolean;
  onClose: () => void;
  guestData: {
    name: string;
    email: string;
    phone: string;
  };
}

interface SignupFormData {
  password: string;
  confirmPassword: string;
}

export const GuestSignupPrompt: React.FC<GuestSignupPromptProps> = ({
  isOpen,
  onClose,
  guestData
}) => {
  const { guestSession, convertGuestToCustomer } = useGuestSession();
  const [formData, setFormData] = useState<SignupFormData>({
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: keyof SignupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (formData.password.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Create Supabase auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: guestData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: guestData.name,
            phone: guestData.phone
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // Create customer account record
        const { data: customerData, error: customerError } = await supabase
          .from('customer_accounts')
          .insert({
            user_id: authData.user.id,
            name: guestData.name,
            email: guestData.email,
            phone: guestData.phone,
            email_verified: false,
            phone_verified: false
          })
          .select()
          .single();

        if (customerError) {
          throw customerError;
        }

        // Convert guest cart and orders to this customer
        if (guestSession?.sessionId) {
          await convertGuestToCustomer(customerData.id);
        }

        toast({
          title: "Account Created Successfully!",
          description: "Your guest orders have been linked to your new account. Please check your email to verify your account.",
        });

        onClose();
      }
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast({
        title: "Account Creation Failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Order Complete!
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Create an account to track your orders and unlock exclusive benefits
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Benefits Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Why Create an Account?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Track your order status in real-time</span>
              </div>
              <div className="flex items-center gap-3">
                <Star className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">Save favorites and reorder quickly</span>
              </div>
              <div className="flex items-center gap-3">
                <Gift className="h-4 w-4 text-purple-600" />
                <span className="text-sm">Get exclusive offers and early access</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Your order history will be preserved</span>
              </div>
            </CardContent>
          </Card>

          {/* Pre-filled Information */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              We'll use the information from your order:
            </Label>
            <Card className="mt-2">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{guestData.email}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Name: {guestData.name} • Phone: {guestData.phone}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Password Setup */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Create Password
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Minimum 6 characters"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Repeat your password"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose} 
              className="flex-1"
              disabled={isLoading}
            >
              Maybe Later
            </Button>
            <Button 
              onClick={handleCreateAccount} 
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              By creating an account, you agree to our terms and privacy policy
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};