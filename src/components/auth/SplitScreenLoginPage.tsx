import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerDirectAuth } from '@/hooks/useCustomerDirectAuth';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
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
type AuthView = 'login' | 'register';

const SplitScreenLoginPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<AuthView>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Authentication hooks
  const { isLoading, login, register, signUpWithGoogle } = useCustomerDirectAuth();
  const { customerAccount } = useCustomerAuth();

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

  const handleLogin = async (data: LoginForm) => {
    const result = await login(data.email, data.password);
    
    if (result.success && result.redirect) {
      navigate(result.redirect);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    const result = await register({
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone
    });

    if (result.success) {
      if (result.requiresEmailVerification) {
        // Show success message, stay on current page
        registerForm.reset();
      } else {
        navigate('/customer-portal');
      }
    }
  };

  const handleGoogleAuth = async () => {
    await signUpWithGoogle();
    // Redirect will be handled by the OAuth flow
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 11);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left Side - Hero Image (50%) */}
      <div className="w-full lg:w-1/2 relative overflow-hidden h-64 lg:h-screen">
        <div 
          className="w-full h-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/lovable-uploads/38d91221-666e-459c-bef5-919b5455e55b.png')`
          }}
        />
        <div className="absolute inset-0 bg-black/50" />
        
        {/* Hero Content */}
        <div className="absolute inset-0 flex flex-col justify-center px-6 lg:px-12 text-white">
          <div className="max-w-md">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 leading-tight">
              Delicious Bites, Big Smiles
            </h2>
            <p className="text-lg lg:text-xl text-white/90">
              Crispy, savory small chops, freshly made and delivered fast.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms (50%) */}
      <div className="w-full lg:w-1/2 flex flex-col">
        {/* Top Bar with Back Arrow and Logo */}
        <div className="flex justify-between items-center p-6 lg:p-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <img 
            src={startersLogo} 
            alt="Starters" 
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Auth Content */}
        <div className="flex-1 flex items-center justify-center px-6 lg:px-8 pb-8">
          <div className="w-full max-w-sm space-y-6">
            {/* Auth Header */}
            <div className="text-left space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {view === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-muted-foreground text-sm">
                {view === 'login' 
                  ? 'Enter your email and password to sign in' 
                  : 'Fill in your details to get started'
                }
              </p>
            </div>

            {/* Forms */}
            {view === 'login' ? (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="h-11"
                    {...loginForm.register('email')}
                    disabled={isLoading}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="h-11 pr-10"
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

                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-medium" 
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>

                <GoogleAuthButton 
                  onGoogleAuth={handleGoogleAuth} 
                  isLoading={isLoading} 
                  text="Login with Google"
                  variant="outline"
                  mode="login"
                />

                <div className="text-center">
                  <span className="text-sm text-muted-foreground">Are you new here? </span>
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
              <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    className="h-11"
                    {...registerForm.register('name')}
                    disabled={isLoading}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="h-11"
                    {...registerForm.register('email')}
                    disabled={isLoading}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="09120020048"
                    className="h-11"
                    {...registerForm.register('phone', {
                      onChange: (e) => {
                        e.target.value = formatPhoneNumber(e.target.value);
                      }
                    })}
                    disabled={isLoading}
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your Nigerian phone number
                  </p>
                  {registerForm.formState.errors.phone && (
                    <p className="text-sm text-destructive">{registerForm.formState.errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      className="h-11 pr-10"
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
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      className="h-11 pr-10"
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

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-medium" 
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>

                <GoogleAuthButton 
                  onGoogleAuth={handleGoogleAuth} 
                  isLoading={isLoading} 
                  text="Sign up with Google"
                  variant="outline"
                  mode="register"
                />

                <div className="text-center">
                  <span className="text-sm text-muted-foreground">Already have an account? </span>
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
    </div>
  );
};

export default SplitScreenLoginPage;