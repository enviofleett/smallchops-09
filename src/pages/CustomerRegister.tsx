import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRegistrationDebug } from '@/services/registrationDebugService';
import { useOTPAuth } from '@/hooks/useOTPAuth';
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle, Mail, User, Phone, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import startersLogo from '@/assets/starters-logo.png';
import AuthFormValidation from '@/components/auth/AuthFormValidation';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { OTPInput } from '@/components/auth/OTPInput';

const CustomerRegister = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [tempFormData, setTempFormData] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signUp, signUpWithGoogle } = useAuth();
  const { logDebug } = useRegistrationDebug();
  const { sendOTP } = useOTPAuth();

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

    // Log registration attempt for monitoring
    await logDebug('Customer registration started', 'info', {
      email: formData.email,
      hasPhone: !!formData.phone,
      timestamp: new Date().toISOString()
    });

    try {
      // Store form data temporarily
      setTempFormData(formData);
      
      // Send OTP for registration verification
      const result = await sendOTP(formData.email, 'registration', formData.name);
      
      if (result.success) {
        setShowOTPVerification(true);
        toast({
          title: "Verification code sent",
          description: `Please check ${formData.email} for your 6-digit verification code.`,
        });
      } else {
        throw new Error(result.error || 'Failed to send verification code');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Log registration failure
      await logDebug('Customer registration failed', 'error', {
        email: formData.email,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Registration failed",
        description: error.message || "Failed to send verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerified = async (verificationResult: any) => {
    if (!tempFormData) return;
    
    setIsLoading(true);
    
    try {
      // Create account with confirmed email
      await signUp({
        email: tempFormData.email,
        password: tempFormData.password,
        name: tempFormData.name,
        phone: tempFormData.phone
      });

      // Log successful registration
      await logDebug('Customer registration successful', 'info', {
        email: tempFormData.email,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Registration successful!",
        description: "Your account has been created successfully.",
      });

      // Clear form on success
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
      });
      setTempFormData(null);
      setShowOTPVerification(false);

      // Redirect to customer portal
      navigate('/customer-portal');
    } catch (error: any) {
      console.error('Account creation error:', error);
      
      // Log registration failure
      await logDebug('Customer account creation failed', 'error', {
        email: tempFormData.email,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Account creation failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToForm = () => {
    setShowOTPVerification(false);
    setTempFormData(null);
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
          {showOTPVerification ? (
            <OTPInput
              email={tempFormData?.email || ''}
              purpose="registration"
              customerName={tempFormData?.name}
              onVerified={handleOTPVerified}
              onBack={handleBackToForm}
            />
          ) : (
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
                    placeholder="Create a password (min 6 characters)"
                    className="pl-10 pr-10"
                    required
                    minLength={6}
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
                Send Verification Code
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerRegister;