import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerDirectAuth } from '@/hooks/useCustomerDirectAuth';
// Removed OTP registration in favor of direct signup
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { useToast } from '@/hooks/use-toast';
import { useCaptcha } from '@/hooks/useCaptcha';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import AuthFormValidation from '@/components/auth/AuthFormValidation';
import CaptchaComponent from '@/components/auth/CaptchaComponent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Loader2, Shield, Users, AlertTriangle } from 'lucide-react';

type AuthView = 'customer-login' | 'customer-register' | 'forgot-password';

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Customer-only authentication page
  const [view, setView] = useState<AuthView>('customer-login');
  
  // Customer authentication hooks only
  const { login: customerLogin, register: customerRegister, signUpWithGoogle, isLoading: isCustomerLoading } = useCustomerDirectAuth();
  const { sendPasswordReset, isLoading: isPasswordResetLoading } = usePasswordReset();

  // CAPTCHA integration
  const {
    captchaToken,
    isCaptchaVerified,
    isCaptchaRequired,
    attemptCount,
    isBlocked,
    timeUntilUnblock,
    recordFailedAttempt,
    recordSuccessfulAttempt,
    verifyCaptcha,
    resetCaptcha,
    canAttemptLogin
  } = useCaptcha({
    requiredAfterAttempts: 2, // Require CAPTCHA after 2 failed attempts
    maxAttempts: 5,
    cooldownPeriod: 300000, // 5 minutes
    autoReset: true
  });

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

  // Removed OTP-related state for direct registration

  // Redirect admins to dedicated admin auth page and handle view parameter
  useEffect(() => {
    const mode = searchParams.get('mode');
    const view = searchParams.get('view');
    
    if (mode === 'admin') {
      navigate('/admin/auth', { replace: true });
    } else if (view === 'register') {
      setView('customer-register');
    }
  }, [searchParams, navigate]);

  // Removed OTP registration step tracking

  const getCurrentLoadingState = () => {
    if (view === 'customer-login' || view === 'customer-register') return isCustomerLoading;
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
    
    // Check if blocked due to too many attempts
    if (isBlocked) {
      toast({
        title: "Too many attempts",
        description: `Please wait ${Math.ceil(timeUntilUnblock / 60)} minutes before trying again.`,
        variant: "destructive"
      });
      return;
    }

    // Check CAPTCHA requirement
    if (isCaptchaRequired && !isCaptchaVerified) {
      toast({
        title: "CAPTCHA required",
        description: "Please complete the security verification first.",
        variant: "destructive"
      });
      return;
    }
    
    const result = await customerLogin(
      formData.email, 
      formData.password, 
      captchaToken || undefined
    );
    
    if (result.success && result.redirect) {
      recordSuccessfulAttempt();
      resetCaptcha();
      navigate(result.redirect);
    } else {
      recordFailedAttempt();
      resetCaptcha(); // Reset CAPTCHA on failed attempt to require new verification
    }
  };

  const handleCustomerRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCustomerRegistration()) return;

    const result = await customerRegister({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone
    });

    if (result.success) {
      toast({
        title: "Check your email",
        description: "Please check your email to verify your account before signing in.",
      });
      setView('customer-login');
      // Clear form data
      setFormData({
        email: formData.email, // Keep email for login
        password: '',
        confirmPassword: '',
        name: '',
        phone: '',
        otp: ''
      });
    }
  };

  // Removed OTP verification handlers for direct registration

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
    // Check if blocked due to too many attempts
    if (isBlocked) {
      toast({
        title: "Too many attempts",
        description: `Please wait ${Math.ceil(timeUntilUnblock / 60)} minutes before trying again.`,
        variant: "destructive"
      });
      return;
    }

    try {
      await signUpWithGoogle(captchaToken || undefined);
      recordSuccessfulAttempt();
      resetCaptcha();
    } catch (error) {
      recordFailedAttempt();
      resetCaptcha();
    }
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

      {/* CAPTCHA Component - Show when required */}
      {isCaptchaRequired && (
        <CaptchaComponent
          onVerify={verifyCaptcha}
          onError={(error) => {
            console.error('CAPTCHA error:', error);
            toast({
              title: "CAPTCHA Error",
              description: "Please try refreshing the page if the issue persists.",
              variant: "destructive"
            });
          }}
          onExpire={resetCaptcha}
          disabled={getCurrentLoadingState()}
          required={true}
          className="w-full"
        />
      )}

      {/* Security Status Alert */}
      {attemptCount > 0 && !isBlocked && (
        <Alert variant={attemptCount >= 2 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {attemptCount === 1 && "1 failed attempt. CAPTCHA will be required after 1 more failed attempt."}
            {attemptCount >= 2 && `${attemptCount} failed attempts. CAPTCHA verification required.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Blocked Status Alert */}
      {isBlocked && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Too many failed attempts. Please wait {Math.ceil(timeUntilUnblock / 60)} minutes before trying again.
          </AlertDescription>
        </Alert>
      )}

      <Button 
        type="submit" 
        className="w-full" 
        disabled={getCurrentLoadingState() || isBlocked || (isCaptchaRequired && !isCaptchaVerified)}
      >
        {getCurrentLoadingState() && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isBlocked ? `Blocked (${Math.ceil(timeUntilUnblock / 60)}m)` : 'Sign In'}
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

  // Removed OTP verification form for direct registration

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
      case 'forgot-password': return 'Reset password';
      default: return 'Welcome';
    }
  };

  const getSubtitle = () => {
    switch (view) {
      case 'customer-login': return 'Sign in to your customer account';
      case 'customer-register': return 'Create your customer account';
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
      {view === 'forgot-password' && renderForgotPasswordForm()}
    </AuthLayout>
  );
};

export default AuthPage;