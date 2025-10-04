
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import startersLogo from '@/assets/starters-logo.png';
import { EnhancedInputField } from '@/components/auth/EnhancedInputField';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

const AdminAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const { login, signUpAdmin, isAuthenticated, userType } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Production: Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && userType === 'admin') {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, userType, navigate, location]);

  // Production: Clear form on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setEmail('');
      setPassword('');
      setName('');
      setError('');
    };
  }, []);

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

  const validateForm = () => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.message || 'Invalid email');
      return false;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message || 'Invalid password');
      return false;
    }
    
    if (!isLogin) {
      const nameValidation = validateName(name);
      if (!nameValidation.valid) {
        setError(nameValidation.message || 'Invalid name');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Production: Validate form before proceeding
    if (!validateForm()) {
      return;
    }
    
    // Production: Rate limiting for security
    if (attemptCount >= 5) {
      setError('Too many failed attempts. Please wait 5 minutes before trying again.');
      toast({
        title: "Security Alert",
        description: "Multiple failed login attempts detected. Please wait before trying again.",
        variant: "destructive",
      });
      return;
    }
    
    setError('');
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      setError('Request timed out. Please check your connection and try again.');
      toast({
        title: "Connection Timeout",
        description: "The request took too long. Please try again.",
        variant: "destructive",
      });
    }, 30000); // 30 second timeout

    try {
      if (isLogin) {
        console.log('Admin login attempt:', { email, timestamp: new Date().toISOString() });
        const result = await login({ email, password });
        clearTimeout(timeoutId);
        
        if (result.success) {
          setAttemptCount(0); // Reset on successful login
          toast({
            title: "Login successful",
            description: "Welcome back to the admin dashboard.",
          });
          
          // Production: Use replace to prevent back button issues
          const redirectPath = result.redirect || '/dashboard';
          navigate(redirectPath, { replace: true });
        } else {
          setAttemptCount(prev => prev + 1);
          const errorMessage = result.error || 'Login failed';
          setError(errorMessage);
          
          // Production: Log failed attempts for security monitoring
          console.warn('Admin login failed:', { 
            email, 
            error: errorMessage, 
            attempt: attemptCount + 1,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.log('Admin signup attempt:', { email, timestamp: new Date().toISOString() });
        const result = await signUpAdmin({ email, password, name });
        clearTimeout(timeoutId);
        
        if (result.success) {
          if (result.requiresEmailVerification) {
            toast({
              title: "Admin account created",
              description: "Please check your email to verify your account.",
            });
            
            // Switch to login view after successful signup
            setIsLogin(true);
            setEmail('');
            setPassword('');
            setName('');
          } else {
            toast({
              title: "Admin account created",
              description: "Your admin account has been created successfully.",
            });
            navigate(result.redirect || '/dashboard', { replace: true });
          }
        } else {
          setError(result.error || 'Admin registration failed');
          console.error('Admin signup failed:', { 
            email, 
            error: result.error,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Auth error:', {
        error: error.message,
        stack: error.stack,
        email,
        isLogin,
        timestamp: new Date().toISOString()
      });
      
      const errorMessage = error.message || 'An unexpected error occurred';
      setError(errorMessage);
      setAttemptCount(prev => prev + 1);
      
      // Production: User-friendly error messages
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (error.message?.includes('timeout')) {
        setError('Request timed out. Please try again.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleSwitchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setAttemptCount(0); // Reset attempt count when switching modes
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
              onError={(e) => {
                console.error('Logo failed to load');
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? 'Admin Login' : 'Create Admin Account'}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Access the admin dashboard' 
              : 'Create a new admin account'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Production: Rate limiting warning */}
            {attemptCount >= 3 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  Multiple failed attempts detected. Account may be temporarily locked after 5 failed attempts.
                </AlertDescription>
              </Alert>
            )}

            {isLogin && isLoading && (
              <Alert className="border-blue-200 bg-blue-50">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Logging you in and setting up your admin access...
                </AlertDescription>
              </Alert>
            )}

            {!isLogin && (
              <>
                <EnhancedInputField
                  id="name"
                  label="Full Name"
                  type="text"
                  value={name}
                  onChange={setName}
                  placeholder="Enter your full name"
                  icon={<User className="h-4 w-4" />}
                  required
                  disabled={isLoading}
                  minLength={2}
                  maxLength={100}
                  validate={validateName}
                  helperText="Your full name as it should appear in the system"
                />
              </>
            )}

            <EnhancedInputField
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="admin@example.com"
              icon={<Mail className="h-4 w-4" />}
              required
              disabled={isLoading}
              autoComplete={isLogin ? 'username' : 'email'}
              validate={validateEmail}
              helperText="Your admin email address"
            />

            <div className="space-y-3">
              <EnhancedInputField
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={isLogin ? 'Enter your password' : 'Create a strong password'}
                icon={<Lock className="h-4 w-4" />}
                required
                disabled={isLoading}
                minLength={8}
                maxLength={128}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                validate={validatePassword}
                showPasswordToggle
                helperText={isLogin ? undefined : 'Choose a strong password for your admin account'}
              />
              
              {!isLogin && password && (
                <PasswordStrengthIndicator password={password} />
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || attemptCount >= 5}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Login' : 'Create Account'}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={handleSwitchMode}
                disabled={isLoading}
                className="text-sm"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Login"
                }
              </Button>
            </div>

            <div className="flex items-center justify-center pt-4 border-t">
              <Link 
                to="/" 
                className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Store</span>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuth;
