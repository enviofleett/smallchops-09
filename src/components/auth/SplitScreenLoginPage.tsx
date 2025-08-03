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
        <div 
          className="w-full h-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/lovable-uploads/cbbd489f-c162-4793-86de-b95b5429317b.png')`
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Hero Content */}
        <div className="absolute bottom-16 left-8 right-8">
          <div className="bg-black/20 backdrop-blur-sm border border-white/20 rounded-lg p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">
              Delicious Bites, Big Smiles
            </h2>
            <p className="text-white/90">
              Crispy, savory small chops, freshly made and delivered fast.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 lg:max-w-md xl:max-w-lg flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Back Button */}
          <button 
            onClick={() => window.history.back()}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Logo */}
          <div className="text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-primary">
              <img 
                src={startersLogo} 
                alt="Starters" 
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>

          {/* Auth Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {view === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
          </div>

          {/* Forms */}
          {view === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  {...loginForm.register('email')}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className="w-full h-12 px-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    {...loginForm.register('password')}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-auto p-0 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                  </Button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setView('register')}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot Password
                </button>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>

              <div className="text-center text-sm text-gray-500">
                Or
              </div>

              <GoogleAuthButton 
                onGoogleAuth={async () => {
                  await handleGoogleAuth();
                }} 
                isLoading={isLoading} 
                text="Login with Google"
                variant="outline"
                mode="login"
              />

              <div className="text-center">
                <span className="text-sm text-gray-600">Are you new here? </span>
                <button
                  type="button"
                  onClick={() => setView('register')}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Create Account
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Full Name"
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  {...registerForm.register('name')}
                  disabled={isLoading}
                />
                {registerForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  {...registerForm.register('email')}
                  disabled={isLoading}
                />
                {registerForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="09120020048"
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  {...registerForm.register('phone', {
                    onChange: (e) => {
                      e.target.value = formatPhoneNumber(e.target.value);
                    }
                  })}
                  disabled={isLoading}
                  maxLength={11}
                />
                <p className="text-xs text-gray-500">
                  Enter your Nigerian phone number
                </p>
                {registerForm.formState.errors.phone && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className="w-full h-12 px-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    {...registerForm.register('password')}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-auto p-0 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                  </Button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    className="w-full h-12 px-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    {...registerForm.register('confirmPassword')}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-auto p-0 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                  </Button>
                </div>
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>

              <div className="text-center text-sm text-gray-500">
                Or
              </div>

              <GoogleAuthButton 
                onGoogleAuth={async () => {
                  await handleGoogleAuth();
                }} 
                isLoading={isLoading} 
                text="Sign up with Google"
                variant="outline"
                mode="register"
              />

              <div className="text-center">
                <span className="text-sm text-gray-600">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Sign in
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