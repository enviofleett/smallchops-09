import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerDirectAuth } from '@/hooks/useCustomerDirectAuth';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { useToast } from '@/hooks/use-toast';
import AuthLayout from '@/components/auth/AuthLayout';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Mail, Lock, User, Phone } from 'lucide-react';
import { EnhancedInputField } from '@/components/auth/EnhancedInputField';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

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


  // State
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
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
      // Format Nigerian phone number - only allow digits
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 11) {
        setFormData(prev => ({ ...prev, [field]: digits }));
      }
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return { valid: false, message: 'Email is required' };
    }
    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Please enter a valid email address' };
    }
    return { valid: true };
  };

  const validatePassword = (password: string) => {
    if (!password) {
      return { valid: false, message: 'Password is required' };
    }
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return { valid: false, message: 'Password must contain uppercase, lowercase, and number' };
    }
    return { valid: true };
  };

  const validateName = (name: string) => {
    if (!name) {
      return { valid: false, message: 'Name is required' };
    }
    if (name.trim().length < 2) {
      return { valid: false, message: 'Name must be at least 2 characters' };
    }
    return { valid: true };
  };

  const validatePhone = (phone: string) => {
    if (!phone) {
      return { valid: false, message: 'Phone number is required' };
    }
    if (phone.length !== 11) {
      return { valid: false, message: 'Please enter a valid 11-digit Nigerian phone number' };
    }
    if (!phone.startsWith('0')) {
      return { valid: false, message: 'Phone number must start with 0' };
    }
    return { valid: true };
  };

  const validateCustomerRegistration = () => {
    const nameValidation = validateName(formData.name);
    if (!nameValidation.valid) {
      toast({ title: "Invalid name", description: nameValidation.message, variant: "destructive" });
      return false;
    }
    
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      toast({ title: "Invalid email", description: emailValidation.message, variant: "destructive" });
      return false;
    }
    
    const phoneValidation = validatePhone(formData.phone);
    if (!phoneValidation.valid) {
      toast({ title: "Invalid phone", description: phoneValidation.message, variant: "destructive" });
      return false;
    }
    
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      toast({ title: "Weak password", description: passwordValidation.message, variant: "destructive" });
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
    await signUpWithGoogle();
  };


  const renderLoginForm = () => (
    <form onSubmit={handleCustomerLogin} className="space-y-4">
      <EnhancedInputField
        id="email"
        label="Email"
        type="email"
        value={formData.email}
        onChange={(value) => handleInputChange('email', value)}
        placeholder="your.email@example.com"
        icon={<Mail className="h-4 w-4" />}
        required
        disabled={getCurrentLoadingState()}
        validate={validateEmail}
        autoComplete="username"
      />

      <EnhancedInputField
        id="password"
        label="Password"
        type="password"
        value={formData.password}
        onChange={(value) => handleInputChange('password', value)}
        placeholder="Enter your password"
        icon={<Lock className="h-4 w-4" />}
        required
        disabled={getCurrentLoadingState()}
        showPasswordToggle
        autoComplete="current-password"
      />


      <Button 
        type="submit" 
        className="w-full" 
        disabled={getCurrentLoadingState()}
      >
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
      <EnhancedInputField
        id="name"
        label="Full Name"
        type="text"
        value={formData.name}
        onChange={(value) => handleInputChange('name', value)}
        placeholder="John Doe"
        icon={<User className="h-4 w-4" />}
        required
        disabled={getCurrentLoadingState()}
        validate={validateName}
        helperText="Your full name as it appears on your ID"
      />

      <EnhancedInputField
        id="email"
        label="Email"
        type="email"
        value={formData.email}
        onChange={(value) => handleInputChange('email', value)}
        placeholder="your.email@example.com"
        icon={<Mail className="h-4 w-4" />}
        required
        disabled={getCurrentLoadingState()}
        validate={validateEmail}
        autoComplete="email"
        helperText="We'll send order confirmations to this email"
      />

      <EnhancedInputField
        id="phone"
        label="Phone Number"
        type="tel"
        value={formData.phone}
        onChange={(value) => handleInputChange('phone', value)}
        placeholder="09012345678"
        icon={<Phone className="h-4 w-4" />}
        required
        disabled={getCurrentLoadingState()}
        maxLength={11}
        validate={validatePhone}
        helperText="11-digit Nigerian phone number"
      />

      <div className="space-y-3">
        <EnhancedInputField
          id="password"
          label="Password"
          type="password"
          value={formData.password}
          onChange={(value) => handleInputChange('password', value)}
          placeholder="Create a strong password"
          icon={<Lock className="h-4 w-4" />}
          required
          disabled={getCurrentLoadingState()}
          showPasswordToggle
          validate={validatePassword}
          autoComplete="new-password"
          helperText="Minimum 8 characters with uppercase, lowercase, and number"
        />
        
        {formData.password && (
          <PasswordStrengthIndicator password={formData.password} />
        )}
      </div>

      <EnhancedInputField
        id="confirmPassword"
        label="Confirm Password"
        type="password"
        value={formData.confirmPassword}
        onChange={(value) => handleInputChange('confirmPassword', value)}
        placeholder="Re-enter your password"
        icon={<Lock className="h-4 w-4" />}
        required
        disabled={getCurrentLoadingState()}
        showPasswordToggle
        autoComplete="new-password"
        error={
          formData.confirmPassword && formData.password !== formData.confirmPassword
            ? 'Passwords do not match'
            : undefined
        }
        success={
          formData.confirmPassword && formData.password === formData.confirmPassword
        }
      />

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
      <EnhancedInputField
        id="email"
        label="Email"
        type="email"
        value={formData.email}
        onChange={(value) => handleInputChange('email', value)}
        placeholder="your.email@example.com"
        icon={<Mail className="h-4 w-4" />}
        required
        disabled={getCurrentLoadingState()}
        validate={validateEmail}
        helperText="We'll send password reset instructions to this email"
      />

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
      case 'customer-login': return 'Welcome to Starters';
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