import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handlePostLoginRedirect } from '@/utils/redirect';
import { useCustomerDirectAuth } from '@/hooks/useCustomerDirectAuth';
import { User, Mail, Phone, Lock, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import startersLogo from '@/assets/starters-logo-christmas.png';
import AuthFormValidation from '@/components/auth/AuthFormValidation';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';


const CustomerRegister = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { register, signUpWithGoogle } = useCustomerDirectAuth();
  

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (field: string, value: string) => {
    if (field === 'phone') {
      // Clean and format Nigerian phone number
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 11) {
        // Store clean digits but display formatted
        setFormData(prev => ({ ...prev, [field]: digits }));
        return;
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

    // Nigerian phone validation - expect 11 digits starting with 0
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11 || !phoneDigits.startsWith('0')) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Nigerian phone number in format 09120020048",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long for security.",
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
      console.log('=== Starting Registration Process ===');
      console.log('Form data:', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        hasPassword: !!formData.password
      });

      // Create account using customer direct auth
      const result = await register({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        name: formData.name.trim(),
        phone: formData.phone.trim()
      });

      console.log('Registration result:', result);

      if (!result.success) {
        let errorMessage = result.error || 'Registration failed';
        
        // Provide specific error messages based on common issues
        if (errorMessage.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (errorMessage.includes('rate limit')) {
          errorMessage = 'Too many registration attempts. Please wait a few minutes and try again.';
        } else if (errorMessage.includes('invalid email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (errorMessage.includes('password')) {
          errorMessage = 'Password must be at least 8 characters long.';
        } else if (errorMessage.includes('phone')) {
          errorMessage = 'Please enter a valid Nigerian phone number (11 digits starting with 0).';
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: "Registration successful!",
        description: "Please check your email for a verification code to complete your registration.",
        duration: 6000,
      });

      // Clear sensitive form data but keep email for verification
      setFormData({
        name: '',
        email: formData.email, // Keep for OTP verification
        phone: '',
        password: '',
        confirmPassword: '',
      });

      // Navigate to verification page or stay for OTP input
      console.log('Registration completed, awaiting OTP verification');
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      let displayMessage = error.message || "Failed to create account. Please try again.";
      
      // Handle specific network or Edge Function errors
      if (error.message?.includes('Edge Function returned a non-2xx status code')) {
        displayMessage = "Registration service is temporarily unavailable. Please try again in a few minutes.";
      } else if (error.message?.includes('Failed to fetch')) {
        displayMessage = "Network connection issue. Please check your internet connection and try again.";
      }
      
      toast({
        title: "Registration failed",
        description: displayMessage,
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  };


  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    try {
      await signUpWithGoogle();
    } catch (error: any) {
      // Error handling is done in AuthContext
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
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
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
                <Label htmlFor="email">Email Address *</Label>
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
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="09120020048"
                    className="pl-10"
                    required
                    disabled={isLoading}
                    maxLength={13}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your Nigerian phone number. Format: 09120020048
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Create a password (min 8 characters)"
                    className="pl-10 pr-10"
                    required
                    minLength={8}
                    disabled={isLoading}
                    onFocus={() => setShowValidation(true)}
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
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Confirm your password"
                    className="pl-10 pr-10"
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

              {showValidation && (
                <AuthFormValidation
                  email={formData.email}
                  password={formData.password}
                  confirmPassword={formData.confirmPassword}
                  showValidation={showValidation}
                />
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <GoogleAuthButton 
                onGoogleAuth={handleGoogleSignUp} 
                isLoading={isLoading}
                text="Continue with Google"
              />

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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerRegister;