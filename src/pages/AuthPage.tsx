import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerDirectAuth } from '@/hooks/useCustomerDirectAuth';
import { useCustomerRegistration } from '@/hooks/useCustomerRegistration';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { useToast } from '@/hooks/use-toast';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import AuthFormValidation from '@/components/auth/AuthFormValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Loader2, Shield, Users } from 'lucide-react';

type AuthView = 'customer-login' | 'customer-register' | 'otp-verification' | 'forgot-password';

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Customer-only authentication page
  const [view, setView] = useState<AuthView>('customer-login');
  
  // Customer authentication hooks only
  const { login: customerLogin, signUpWithGoogle, isLoading: isCustomerLoading } = useCustomerDirectAuth();
  const { 
    initiateRegistration, 
    verifyOTPAndCompleteRegistration, 
    resendOTP,
    registrationStep,
    registrationEmail,
    isLoading: isRegistrationLoading 
  } = useCustomerRegistration();
  const { sendPasswordReset, isLoading: isPasswordResetLoading } = usePasswordReset();

  // State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    otp: ''
  });

  // Store registration data for OTP verification
  const [pendingRegistration, setPendingRegistration] = useState<{
    email: string;
    password: string;
    name: string;
    phone?: string;
  } | null>(null);

  // Redirect admins to dedicated admin auth page
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'admin') {
      navigate('/admin/auth', { replace: true });
    }
  }, [searchParams, navigate]);

  // Handle registration step changes
  useEffect(() => {
    if (registrationStep === 'otp_verification' && registrationEmail) {
      setView('otp-verification');
    } else if (registrationStep === 'completed') {
      setView('customer-login');
      setPendingRegistration(null);
      toast({
        title: "Registration completed!",
        description: "You can now log in with your credentials.",
      });
    }
  }, [registrationStep, registrationEmail, toast]);

  const getCurrentLoadingState = () => {
    if (view === 'customer-login') return isCustomerLoading;
    if (view === 'customer-register' || view === 'otp-verification') return isRegistrationLoading;
    if (view === 'forgot-password') return isPasswordResetLoading;
    return false;
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'phone') {
      // Format Nigerian phone number
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 11) {
        setFormData(prev => ({ ...prev, [field]: digits }));
        return;
      }
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateCustomerRegistration = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
      return false;
    }
    
    if (!formData.phone.trim()) {
      toast({ title: "Phone required", description: "Phone number is required for customer registration.", variant: "destructive" });
      return false;
    }
    
    if (formData.phone.length !== 11) {
      toast({ title: "Invalid phone", description: "Please enter a valid 11-digit Nigerian phone number.", variant: "destructive" });
      return false;
    }
    
    if (formData.password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Password mismatch", description: "Passwords do not match.", variant: "destructive" });
      return false;
    }
    
    return true;
  };


  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await customerLogin(formData.email, formData.password);
    
    if (result.success && result.redirect) {
      navigate(result.redirect);
    }
  };

  const handleCustomerRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCustomerRegistration()) return;

    const result = await initiateRegistration({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone
    });

    if (result.success && result.requiresOtpVerification) {
      setPendingRegistration({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone
      });
    }
  };

  const handleOTPVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pendingRegistration) {
      toast({ 
        title: "Error", 
        description: "Registration data not found. Please restart registration.", 
        variant: "destructive" 
      });
      setView('customer-register');
      return;
    }

    if (!formData.otp || formData.otp.length !== 6) {
      toast({ 
        title: "Invalid OTP", 
        description: "Please enter the 6-digit verification code.", 
        variant: "destructive" 
      });
      return;
    }

    await verifyOTPAndCompleteRegistration({
      email: pendingRegistration.email,
      otpCode: formData.otp,
      password: pendingRegistration.password,
      name: pendingRegistration.name,
      phone: pendingRegistration.phone
    });
  };

  const handleResendOTP = async () => {
    if (!pendingRegistration) {
      toast({ 
        title: "Error", 
        description: "Registration data not found. Please restart registration.", 
        variant: "destructive" 
      });
      setView('customer-register');
      return;
    }

    await resendOTP(pendingRegistration.email);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast({ 
        title: "Email required", 
        description: "Please enter your email address.", 
        variant: "destructive" 
      });
      return;
    }

    const result = await sendPasswordReset(formData.email);
    
    if (result.success) {
      setView('customer-login');
    }
  };

  const handleGoogleAuth = async () => {
    await signUpWithGoogle();
  };


  const renderLoginForm = () => (
    <form onSubmit={handleCustomerLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
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
            disabled={getCurrentLoadingState()}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Enter your password"
            className="pl-10 pr-10"
            required
            disabled={getCurrentLoadingState()}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            disabled={getCurrentLoadingState()}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={getCurrentLoadingState()}>
        {getCurrentLoadingState() && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign In
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <GoogleAuthButton 
        onGoogleAuth={handleGoogleAuth} 
        isLoading={getCurrentLoadingState()} 
        text="Continue with Google"
      />

      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={() => setView('customer-register')}
          className="text-primary hover:underline"
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => setView('forgot-password')}
          className="text-primary hover:underline"
        >
          Forgot password?
        </button>
      </div>
    </form>
  );

  const renderCustomerRegisterForm = () => (
    <form onSubmit={handleCustomerRegistration} className="space-y-4">
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
            disabled={getCurrentLoadingState()}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
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
            disabled={getCurrentLoadingState()}
            onFocus={() => setShowValidation(true)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
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
            disabled={getCurrentLoadingState()}
            maxLength={11}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter your Nigerian phone number
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Create a password"
            className="pl-10 pr-10"
            required
            disabled={getCurrentLoadingState()}
            onFocus={() => setShowValidation(true)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            disabled={getCurrentLoadingState()}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
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
            disabled={getCurrentLoadingState()}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={getCurrentLoadingState()}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

      <Button type="submit" className="w-full" disabled={getCurrentLoadingState()}>
        {getCurrentLoadingState() && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Account
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <GoogleAuthButton 
        onGoogleAuth={handleGoogleAuth} 
        isLoading={getCurrentLoadingState()} 
        text="Sign up with Google"
      />

      <div className="text-center">
        <button
          type="button"
          onClick={() => setView('customer-login')}
          className="text-sm text-primary hover:underline"
        >
          Already have an account? Sign in
        </button>
      </div>
    </form>
  );

  const renderOTPVerificationForm = () => (
    <form onSubmit={handleOTPVerification} className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Enter verification code</h3>
          <p className="text-muted-foreground">
            We've sent a 6-digit code to{' '}
            <span className="font-medium">{pendingRegistration?.email}</span>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="otp">Verification Code</Label>
        <Input
          id="otp"
          type="text"
          value={formData.otp}
          onChange={(e) => handleInputChange('otp', e.target.value.replace(/\D/g, ''))}
          placeholder="Enter 6-digit code"
          className="text-center text-lg tracking-widest"
          maxLength={6}
          required
          disabled={getCurrentLoadingState()}
        />
      </div>

      <Button type="submit" className="w-full" disabled={getCurrentLoadingState()}>
        {getCurrentLoadingState() && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Verify & Complete Registration
      </Button>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Didn't receive the code? Check your spam folder or request a new one.
        </p>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full" 
          onClick={handleResendOTP}
          disabled={getCurrentLoadingState()}
        >
          {getCurrentLoadingState() && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Resend code
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setView('customer-register');
              setPendingRegistration(null);
              setFormData(prev => ({ ...prev, otp: '' }));
            }}
            className="text-sm text-primary hover:underline flex items-center justify-center space-x-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to registration</span>
          </button>
        </div>
      </div>
    </form>
  );

  const renderForgotPasswordForm = () => (
    <form onSubmit={handleForgotPassword} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
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
            disabled={getCurrentLoadingState()}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={getCurrentLoadingState()}>
        {getCurrentLoadingState() && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send Reset Email
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setView('customer-login')}
          className="text-sm text-primary hover:underline flex items-center justify-center space-x-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to login</span>
        </button>
      </div>
    </form>
  );

  const getTitle = () => {
    switch (view) {
      case 'customer-login': return 'Welcome back';
      case 'customer-register': return 'Create account';
      case 'otp-verification': return 'Verify your email';
      case 'forgot-password': return 'Reset password';
      default: return 'Welcome';
    }
  };

  const getSubtitle = () => {
    switch (view) {
      case 'customer-login': return 'Sign in to your customer account';
      case 'customer-register': return 'Create your customer account';
      case 'otp-verification': return 'Enter the verification code sent to your email';
      case 'forgot-password': return 'Enter your email to reset your password';
      default: return '';
    }
  };

  return (
    <AuthLayout title={getTitle()} subtitle={getSubtitle()}>
      {/* Customer Portal Badge */}
      <div className="flex justify-center mb-6">
        <Badge variant="secondary" className="px-4 py-1">
          Customer Portal
        </Badge>
      </div>

      {/* Render appropriate form */}
      {view === 'customer-login' && renderLoginForm()}
      {view === 'customer-register' && renderCustomerRegisterForm()}
      {view === 'otp-verification' && renderOTPVerificationForm()}
      {view === 'forgot-password' && renderForgotPasswordForm()}
    </AuthLayout>
  );
};

export default AuthPage;