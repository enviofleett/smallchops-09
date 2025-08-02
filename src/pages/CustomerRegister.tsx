import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle, Mail } from 'lucide-react';
import { useEnhancedEmailProcessing } from '@/hooks/useEnhancedEmailProcessing';
import { Link, useNavigate } from 'react-router-dom';
import startersLogo from '@/assets/starters-logo.png';

const CustomerRegister = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailProcessingStatus, setEmailProcessingStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { triggerEnhancedProcessing } = useEnhancedEmailProcessing();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (field: string, value: string) => {
    if (field === 'phone') {
      // Format Nigerian phone number as user types
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 11) {
        if (digits.length >= 1) {
          value = `(${digits.slice(0, 11)})`;
        }
      }
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your full name.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.phone.trim()) {
      toast({
        title: "Phone number required",
        description: "Phone number is required for customer registration.",
        variant: "destructive",
      });
      return false;
    }

    // Nigerian phone validation - expect format like (09120020048)
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11 || !phoneDigits.startsWith('0')) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Nigerian phone number in format (09120020048)",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/customer-portal`,
          data: {
            name: formData.name,
            phone: formData.phone,
            full_name: formData.name,
            registration_source: 'frontend'
          }
        }
      });

      if (error) {
        console.error('Registration error:', error);
        
        // Enhanced error handling for production
        if (error.message.includes('User already registered') || 
            error.message.includes('duplicate key value violates unique constraint') ||
            error.message.includes('already registered')) {
          toast({
            title: "Account Already Exists",
            description: "An account with this email already exists. Please sign in instead or use a different email address.",
            variant: "destructive",
          });
        } else if (error.message.includes('Database error saving new user') || 
                   error.message.includes('record "new" has no field "name"') ||
                   error.message.includes('customers_email') ||
                   error.message.includes('Registration failed at')) {
          toast({
            title: "Registration Processing Error",
            description: "We're experiencing technical difficulties with registration. Our team has been notified. Please try again in a few minutes or contact support.",
            variant: "destructive",
            duration: 8000,
          });
        } else if (error.message.includes('Phone number is required') || 
                   error.message.includes('Phone number must be at least') ||
                   error.message.includes('10 digits')) {
          toast({
            title: "Invalid Phone Number",
            description: "Please enter a valid Nigerian phone number in format (09120020048)",
            variant: "destructive",
          });
        } else if (error.message.includes('Password should be at least 6 characters') ||
                   error.message.includes('password') && error.message.includes('6')) {
          toast({
            title: "Password Too Short",
            description: "Password must be at least 6 characters long.",
            variant: "destructive",
          });
        } else if (error.message.includes('Invalid email') || 
                   error.message.includes('email')) {
          toast({
            title: "Invalid Email",
            description: "Please enter a valid email address.",
            variant: "destructive",
          });
        } else if (error.message.includes('rate limit') || 
                   error.message.includes('too many requests') ||
                   error.message.includes('too many')) {
          toast({
            title: "Too Many Attempts",
            description: "Please wait a few minutes before trying to register again.",
            variant: "destructive",
          });
        } else if (error.message.includes('timeout') || 
                   error.message.includes('network') ||
                   error.message.includes('connection')) {
          toast({
            title: "Connection Issue",
            description: "Network connection problem. Please check your internet and try again.",
            variant: "destructive",
          });
        } else if (error.message.includes('confirm') || 
                   error.message.includes('verification')) {
          toast({
            title: "Email Verification Required",
            description: "Please check your email and click the verification link before signing in.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Registration Failed",
            description: `Unable to complete registration: ${error.message}. Please try again or contact our support team for assistance.`,
            variant: "destructive",
            duration: 10000,
          });
        }
        return;
      }

      if (data.user) {
        toast({
          title: "Registration successful!",
          description: "Welcome! Your account has been created and welcome email is being processed.",
        });

        // Trigger enhanced email processing for immediate welcome email
        setEmailProcessingStatus('processing');
        try {
          const success = await triggerEnhancedProcessing(formData.email, 'customer_welcome');
          if (success) {
            setEmailProcessingStatus('success');
            toast({
              title: "Welcome Email Sent!",
              description: "Your welcome email has been sent successfully.",
            });
          }
        } catch (error) {
          console.error('Enhanced email processing failed:', error);
          // Continue with registration even if email fails
        }

        // Clear form
        setFormData({
          name: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
        });

        // Small delay to show email processing status, then redirect
        setTimeout(() => {
          navigate('/customer-portal');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Registration failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden bg-white shadow-lg">
            <img 
              src={startersLogo} 
              alt="Starters" 
              className="w-full h-full object-contain p-2"
              loading="lazy"
            />
          </div>
          <CardTitle className="text-2xl">Create Customer Account</CardTitle>
          <CardDescription>
            Join Starters to track your orders and favorites
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter your full name"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(09120020048)"
                required
                disabled={isLoading}
                maxLength={13}
              />
              <p className="text-xs text-muted-foreground">
                Enter your Nigerian phone number. Format: (09120020048)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Create a password (min 6 characters)"
                  required
                  minLength={6}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Confirm your password"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>

            {/* Email processing status indicator */}
            {emailProcessingStatus === 'processing' && (
              <div className="flex items-center justify-center space-x-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending welcome email...</span>
              </div>
            )}

            {emailProcessingStatus === 'success' && (
              <div className="flex items-center justify-center space-x-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4" />
                <span>Welcome email sent successfully!</span>
              </div>
            )}

            <div className="flex items-center justify-center space-x-2 text-sm">
              <span className="text-muted-foreground">Already have an account?</span>
              <Link to="/customer-portal" className="text-primary hover:underline">
                Sign in here
              </Link>
            </div>

            <div className="flex items-center justify-center">
              <Link 
                to="/customer-portal" 
                className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Customer Portal</span>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerRegister;