import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuthRegistration } from '@/hooks/useSupabaseAuthRegistration';
import { Mail, User, Lock, Loader2, CheckCircle, RotateCcw } from 'lucide-react';

interface SimpleRegistrationProps {
  onComplete?: () => void;
}

export const SimpleRegistration: React.FC<SimpleRegistrationProps> = ({ onComplete }) => {
  const { toast } = useToast();
  const {
    isLoading,
    registrationStep,
    registrationEmail,
    initiateRegistration,
    verifyOTPAndCompleteRegistration,
    resendOTP,
    resetRegistrationFlow
  } = useSupabaseAuthRegistration();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    otp: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    const result = await initiateRegistration({
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      phone: formData.phone.trim() || undefined
    });

    if (result.success) {
      toast({
        title: "Verification code sent",
        description: "Please check your email for the OTP code.",
      });
    }
  };

  const handleOTPVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.otp.trim()) {
      toast({
        title: "OTP required",
        description: "Please enter the verification code.",
        variant: "destructive",
      });
      return;
    }

    const result = await verifyOTPAndCompleteRegistration({
      email: registrationEmail,
      token: formData.otp.trim(),
      password: formData.password,
      name: formData.name.trim(),
      phone: formData.phone || undefined
    });

    if (result.success) {
      toast({
        title: "Registration completed!",
        description: "Welcome email sent. You can now log in.",
      });
      
      // Reset form
      setFormData({ name: '', email: '', password: '', phone: '', otp: '' });
      
      // Call completion handler
      onComplete?.();
    }
  };

  const handleResendOTP = async () => {
    const result = await resendOTP(registrationEmail);
    if (result.success) {
      toast({
        title: "New code sent",
        description: "A new verification code has been sent to your email.",
      });
    }
  };

  const handleStartOver = () => {
    resetRegistrationFlow();
    setFormData({ name: '', email: '', password: '', phone: '', otp: '' });
  };

  if (registrationStep === 'completed') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-700">Registration Complete!</CardTitle>
          <CardDescription>
            Welcome email sent. You can now log in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleStartOver} 
            variant="outline" 
            className="w-full"
          >
            Register Another Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (registrationStep === 'otp_verification') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            Enter the 6-character code sent to {registrationEmail}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOTPVerification} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                value={formData.otp}
                onChange={(e) => handleInputChange('otp', e.target.value)}
                placeholder="Enter 6-character code"
                maxLength={6}
                className="text-center text-lg tracking-widest"
                disabled={isLoading}
                autoComplete="one-time-code"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify & Complete Registration
            </Button>

            <div className="flex flex-col space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResendOTP}
                disabled={isLoading}
                className="w-full"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Resend Code
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                onClick={handleStartOver}
                disabled={isLoading}
                className="w-full"
              >
                Start Over
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>
          Register with email to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegistration} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter your full name"
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter your email"
                className="pl-10"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter your phone number"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Create a password (min 8 characters)"
                className="pl-10"
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register & Send OTP
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By registering, you agree to receive email notifications for account verification and welcome messages.
          </p>
        </form>
      </CardContent>
    </Card>
  );
};