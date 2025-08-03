import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { OTPInput } from '@/components/auth/OTPInput';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import startersLogo from '@/assets/starters-logo.png';

// Form schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().length(11, 'Phone number must be 11 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type AuthView = 'login' | 'register' | 'otp-verification';

const SplitScreenLoginPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Forms
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '' }
  });

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

  const handleLogin = async (data: LoginForm) => {
    const result = await login(data.email, data.password, 'customer');
    
    if (result.success && 'redirect' in result && result.redirect) {
      navigate(result.redirect);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    const result = await register({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone
    }, 'customer');

    if (result.success && 'requiresOTP' in result && result.requiresOTP) {
      // Will be handled by useEffect
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

  const handleBackFromOTP = () => {
    cancelOTP();
    setView(otpPurpose === 'registration' ? 'register' : 'login');
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 11);
  };

  if (view === 'otp-verification') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8">
          <OTPInput 
            email={otpEmail}
            purpose={otpPurpose || 'login'}
            customerName={otpPurpose === 'registration' ? registerForm.getValues('name') : undefined}
            onVerified={handleOTPVerification}
            onBack={handleBackFromOTP}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Hero Image */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40" />
        <div 
          className="w-full h-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80')`
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Hero Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="max-w-md">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                <img 
                  src={startersLogo} 
                  alt="Starters" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold">Starters</h1>
            </div>
            
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Premium Small Chops & Catering
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Delicious Nigerian small chops delivered fresh to your doorstep. 
              Experience the finest taste in every bite.
            </p>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Fresh ingredients, premium quality</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Fast delivery across Lagos</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Perfect for events & parties</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 lg:max-w-md xl:max-w-lg flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-primary/10">
              <img 
                src={startersLogo} 
                alt="Starters" 
                className="w-10 h-10 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Starters</h1>
            <p className="text-muted-foreground">Premium Small Chops</p>
          </div>

          {/* Auth Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {view === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-muted-foreground">
              {view === 'login' 
                ? 'Sign in to your account to continue' 
                : 'Join us for the best small chops experience'
              }
            </p>
          </div>

          {/* Forms */}
          {view === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    {...loginForm.register('email')}
                    disabled={isLoading}
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                    {...loginForm.register('password')}
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
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
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
                onGoogleAuth={async () => {
                  await handleGoogleAuth();
                }} 
                isLoading={isLoading} 
                text="Continue with Google"
                mode="login"
              />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setView('register')}
                  className="text-sm text-primary hover:underline"
                >
                  Don't have an account? Sign up
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    className="pl-10"
                    {...registerForm.register('name')}
                    disabled={isLoading}
                  />
                </div>
                {registerForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    {...registerForm.register('email')}
                    disabled={isLoading}
                  />
                </div>
                {registerForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="09120020048"
                    className="pl-10"
                    {...registerForm.register('phone', {
                      onChange: (e) => {
                        e.target.value = formatPhoneNumber(e.target.value);
                      }
                    })}
                    disabled={isLoading}
                    maxLength={11}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your Nigerian phone number
                </p>
                {registerForm.formState.errors.phone && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    className="pl-10 pr-10"
                    {...registerForm.register('password')}
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
                {registerForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    className="pl-10 pr-10"
                    {...registerForm.register('confirmPassword')}
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
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

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
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitScreenLoginPage;