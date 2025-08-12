import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { useCaptcha } from '@/hooks/useCaptcha';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import CaptchaComponent from '@/components/auth/CaptchaComponent';
import { Eye, EyeOff, Mail, Lock, Shield, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';

type AdminView = 'login' | 'signup' | 'forgot-password';

const AdminAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { login: adminLogin, signUp: adminSignUp, isLoading: isAdminLoading } = useAuth();
  const { sendPasswordReset, isLoading: isPasswordResetLoading } = usePasswordReset();
  
  // CAPTCHA integration for admin authentication
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
  
  const [view, setView] = useState<AdminView>(() => {
    return searchParams.get('view') === 'signup' ? 'signup' : 'login';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'admin'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
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

    // Check CAPTCHA requirement for admin login
    if (isCaptchaRequired && !isCaptchaVerified) {
      toast({
        title: "CAPTCHA required",
        description: "Please complete the security verification first.",
        variant: "destructive"
      });
      return;
    }
    
    const result = await adminLogin({ 
      email: formData.email, 
      password: formData.password,
      captchaToken: captchaToken || undefined 
    });
    
    if (result.success && result.redirect) {
      recordSuccessfulAttempt();
      resetCaptcha();
      navigate(result.redirect);
    } else {
      recordFailedAttempt();
      resetCaptcha(); // Reset CAPTCHA on failed attempt to require new verification
    }
  };

  const handleAdminSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await adminSignUp({ 
      email: formData.email, 
      password: formData.password,
      name: '', // Optional for admin signup
      phone: '', // Optional for admin signup
      captchaToken: captchaToken || undefined
    });
    
    if (result.success) {
      recordSuccessfulAttempt();
      resetCaptcha();
      toast({
        title: "Account created successfully",
        description: "You can now sign in with your credentials.",
      });
      setView('login');
    } else {
      recordFailedAttempt();
      resetCaptcha();
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

  const getCurrentLoadingState = () => {
    if (view === 'login') return isAdminLoading;
    if (view === 'signup') return isAdminLoading;
    return isPasswordResetLoading;
  };

  const renderLoginForm = () => (
    <form onSubmit={handleAdminLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="Enter your admin email"
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

      {/* CAPTCHA Component for Admin - Show when required */}
      {isCaptchaRequired && (
        <CaptchaComponent
          onVerify={verifyCaptcha}
          onError={(error) => {
            console.error('Admin CAPTCHA error:', error);
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

      {/* Security Status Alert - Only show after actual attempts */}
      {attemptCount > 0 && !isBlocked && (
        <Alert variant={attemptCount >= 2 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {attemptCount === 1 && "Security verification will be required after 1 more failed attempt."}
            {attemptCount >= 2 && `${attemptCount} failed attempts. Please complete security verification.`}
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
        {isBlocked ? `Blocked (${Math.ceil(timeUntilUnblock / 60)}m)` : 'Sign In to Admin Portal'}
      </Button>
      
      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={() => setView('signup')}
          className="text-primary hover:underline"
        >
          Create admin account
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
            placeholder="Enter your admin email"
            className="pl-10"
            required
            disabled={getCurrentLoadingState()}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={getCurrentLoadingState()}>
        {getCurrentLoadingState() && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send Reset Link
      </Button>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setView('login')}
          className="text-primary hover:underline text-sm flex items-center"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to login
        </button>
      </div>
    </form>
  );

  const renderSignUpForm = () => (
    <form onSubmit={handleAdminSignUp} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="Enter your admin email"
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
        Create Admin Account
      </Button>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setView('login')}
          className="text-primary hover:underline text-sm flex items-center"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back to login
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg border p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {view === 'login' ? 'Admin Portal' : view === 'signup' ? 'Create Admin Account' : 'Reset Password'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {view === 'login' 
                ? 'Sign in to access the administration dashboard'
                : view === 'signup'
                ? 'Create a new admin account to access the dashboard'
                : 'Enter your email to receive a password reset link'
              }
            </p>
          </div>

          {/* Form */}
          {view === 'login' ? renderLoginForm() : view === 'signup' ? renderSignUpForm() : renderForgotPasswordForm()}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              ← Back to website
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;