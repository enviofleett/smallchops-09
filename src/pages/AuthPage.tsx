import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomerDirectAuth } from '@/hooks/useCustomerDirectAuth';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { useToast } from '@/hooks/use-toast';
import { handlePostLoginRedirect } from '@/utils/redirect';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import AuthFormValidation from '@/components/auth/AuthFormValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Loader2 } from 'lucide-react';

type AuthView = 'login' | 'register' | 'forgot-password' | 'email-verification';

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Auth hooks - customer only
  const { login, register, resendOtp, signUpWithGoogle, isLoading } = useCustomerDirectAuth();
  const { sendPasswordReset, isLoading: isPasswordResetLoading } = usePasswordReset();

  // State
  const [view, setView] = useState<AuthView>('login');
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
  const [registrationData, setRegistrationData] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // Initialize from URL params
  useEffect(() => {
    const viewParam = searchParams.get('view');
    
    if (viewParam === 'register' || viewParam === 'forgot-password') {
      setView(viewParam);
    }
  }, [searchParams]);

  // Removed auto-redirect logic - handled by AuthRouter

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
      
      if (!formData.phone.trim()) {
        toast({ title: "Phone required", description: "Phone number is required for customer registration.", variant: "destructive" });
        return false;
      }
      
      if (formData.phone.length !== 11) {
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
    
    const result = await login(formData.email, formData.password);
    
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
    });

    if (result.success && 'requiresEmailVerification' in result) {
      // Show email verification message
      setRegistrationData({
        email: formData.email,
        password: formData.password
      });
      setView('email-verification');
    }
  };

  const handleResendEmail = async () => {
    if (!registrationData) {
      toast({ 
        title: "Error", 
        description: "Registration data not found. Please try again.", 
        variant: "destructive" 
      });
      setView('register');
      return;
    }

    const result = await resendOtp(registrationData.email);
    
    if (result.success) {
      toast({
        title: "Email sent",
        description: "A new verification email has been sent to your inbox.",
      });
    }
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
      setView('login');
    }
  };


  const handleGoogleAuth = async () => {
    await signUpWithGoogle();
  };

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

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        isLoading={isLoading} 
        text="Continue with Google"
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
        onGoogleAuth={handleGoogleAuth} 
        isLoading={isLoading} 
        text="Sign up with Google"
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

      <Button type="submit" className="w-full" disabled={isPasswordResetLoading}>
        {isPasswordResetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send Reset Email
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


  const renderEmailVerificationForm = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Check your email</h3>
          <p className="text-muted-foreground">
            We've sent a verification link to{' '}
            <span className="font-medium">{registrationData?.email}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Click the link in your email to complete your registration. 
          If you don't see it, check your spam folder.
        </p>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full" 
          onClick={handleResendEmail}
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Resend verification email
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setView('register');
              setRegistrationData(null);
              setFormData(prev => ({ ...prev, otp: '' }));
            }}
            className="text-sm text-primary hover:underline flex items-center justify-center space-x-1"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to registration</span>
          </button>
        </div>
      </div>
    </div>
  );

  const getTitle = () => {
    switch (view) {
      case 'login': return 'Welcome back';
      case 'register': return 'Create account';
      case 'email-verification': return 'Verify your email';
      case 'forgot-password': return 'Reset password';
      default: return 'Welcome';
    }
  };

  const getSubtitle = () => {
    switch (view) {
      case 'login': return 'Sign in to your customer account';
      case 'register': return 'Create your customer account';
      case 'email-verification': return 'Check your email and click the verification link';
      case 'forgot-password': return 'Enter your email to reset your password';
      default: return '';
    }
  };

  return (
    <AuthLayout title={getTitle()} subtitle={getSubtitle()}>
      {view === 'login' && renderLoginForm()}
      {view === 'register' && renderRegisterForm()}
      {view === 'email-verification' && renderEmailVerificationForm()}
      {view === 'forgot-password' && renderForgotPasswordForm()}
    </AuthLayout>
  );
};

export default AuthPage;