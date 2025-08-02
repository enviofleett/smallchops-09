import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { useToast } from '@/hooks/use-toast';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import AuthFormValidation from '@/components/auth/AuthFormValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OTPInput } from '@/components/auth/OTPInput';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Loader2 } from 'lucide-react';

type AuthMode = 'admin' | 'customer';
type AuthView = 'login' | 'register' | 'forgot-password' | 'otp-verification';

const UnifiedAuthPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Unified auth hook
  const {
    isLoading,
    isOTPRequired,
    otpEmail,
    otpPurpose,
    customerAccount,
    login,
    register,
    completeOTPVerification,
    handleGoogleAuth,
    cancelOTP
  } = useUnifiedAuth();

  // State
  const [mode, setMode] = useState<AuthMode>('customer');
  const [view, setView] = useState<AuthView>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: ''
  });

  // Initialize from URL params
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    const viewParam = searchParams.get('view');
    
    if (modeParam === 'admin' || modeParam === 'customer') {
      setMode(modeParam);
    }
    
    if (viewParam === 'register' || viewParam === 'forgot-password') {
      setView(viewParam);
    }
  }, [searchParams]);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (customerAccount) {
      navigate('/customer-portal');
    }
  }, [customerAccount, navigate]);

  // Handle OTP requirement
  useEffect(() => {
    if (isOTPRequired) {
      setView('otp-verification');
    }
  }, [isOTPRequired]);

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

  const validateForm = () => {
    if (view === 'register') {
      if (!formData.name.trim()) {
        toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
        return false;
      }
      
      if (mode === 'customer' && !formData.phone.trim()) {
        toast({ title: "Phone required", description: "Phone number is required for customer registration.", variant: "destructive" });
        return false;
      }
      
      if (mode === 'customer' && formData.phone.length !== 11) {
        toast({ title: "Invalid phone", description: "Please enter a valid 11-digit Nigerian phone number.", variant: "destructive" });
        return false;
      }
      
      if (formData.password.length < 6) {
        toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        toast({ title: "Password mismatch", description: "Passwords do not match.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await login(formData.email, formData.password, mode);
    
    if (result.success && 'redirect' in result && result.redirect) {
      navigate(result.redirect);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone
    }, mode);

    if (result.success && 'requiresEmailVerification' in result && result.requiresEmailVerification) {
      setView('login');
    }
  };

  const handleOTPVerification = async (result: { success: boolean; code?: string }) => {
    if (result.success && result.code) {
      const verificationResult = await completeOTPVerification(result.code);
      
      if (verificationResult.success && 'redirect' in verificationResult && verificationResult.redirect) {
        navigate(verificationResult.redirect);
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    // This would use the existing password reset flow
    toast({
      title: "Feature coming soon",
      description: "Password reset will be implemented with OTP verification.",
    });
  };

  const handleBackFromOTP = () => {
    cancelOTP();
    setView(otpPurpose === 'registration' ? 'register' : 'login');
  };

  const getTitle = () => {
    if (view === 'otp-verification') {
      return 'Verify Your Email';
    }
    return view === 'login' ? 'Welcome back' : view === 'register' ? 'Create account' : 'Reset password';
  };

  const getSubtitle = () => {
    if (view === 'otp-verification') {
      return `Check your email for the verification code`;
    }
    return view === 'login' 
      ? `Sign in to your ${mode} account` 
      : view === 'register' 
      ? `Create your ${mode} account`
      : 'Enter your email to reset your password';
  };

  const renderModeSelector = () => (
    <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)} className="mb-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="customer">Customer</TabsTrigger>
        <TabsTrigger value="admin">Admin</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-4">
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
            disabled={isLoading}
          />
        </div>
      </div>

      {mode === 'admin' && (
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
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === 'customer' ? 'Send Login Code' : 'Sign In'}
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
        onGoogleAuth={async () => {
          await handleGoogleAuth();
        }} 
        isLoading={isLoading} 
        text="Continue with Google"
        mode="login"
      />

      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={() => setView('register')}
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

  const renderRegisterForm = () => (
    <form onSubmit={handleRegister} className="space-y-4">
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
            disabled={isLoading}
            onFocus={() => setShowValidation(true)}
          />
        </div>
      </div>

      {mode === 'customer' && (
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
              disabled={isLoading}
              maxLength={11}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter your Nigerian phone number
          </p>
        </div>
      )}

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

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        onGoogleAuth={async () => {
          await handleGoogleAuth();
        }} 
        isLoading={isLoading} 
        text="Sign up with Google"
        mode="register"
      />

      <div className="text-center">
        <button
          type="button"
          onClick={() => setView('login')}
          className="text-sm text-primary hover:underline"
        >
          Already have an account? Sign in
        </button>
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
            disabled={isLoading}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send Reset Code
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setView('login')}
          className="text-sm text-primary hover:underline flex items-center justify-center space-x-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to login</span>
        </button>
      </div>
    </form>
  );

  const renderOTPVerification = () => (
    <OTPInput 
      email={otpEmail}
      purpose={otpPurpose || 'login'}
      customerName={otpPurpose === 'registration' ? formData.name : undefined}
      onVerified={handleOTPVerification}
      onBack={handleBackFromOTP}
    />
  );

  const renderCurrentView = () => {
    if (view === 'otp-verification') {
      return renderOTPVerification();
    }

    return (
      <>
        {renderModeSelector()}
        {view === 'login' && renderLoginForm()}
        {view === 'register' && renderRegisterForm()}
        {view === 'forgot-password' && renderForgotPasswordForm()}
      </>
    );
  };

  return (
    <AuthLayout title={getTitle()} subtitle={getSubtitle()}>
      {renderCurrentView()}
    </AuthLayout>
  );
};

export default UnifiedAuthPage;