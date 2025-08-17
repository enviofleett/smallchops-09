import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, Shield, Loader2, ArrowLeft } from 'lucide-react';

type AdminView = 'login' | 'signup' | 'forgot-password';

const AdminAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { login: adminLogin, signUp: adminSignUp, isLoading: isAdminLoading } = useAuth();
  const { sendPasswordReset, isLoading: isPasswordResetLoading } = usePasswordReset();
  
  
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
    
    const result = await adminLogin({ 
      email: formData.email, 
      password: formData.password
    });
    
    if (result.success && result.redirect) {
      navigate(result.redirect);
    }
  };

  const handleAdminSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await adminSignUp({ 
      email: formData.email, 
      password: formData.password,
      name: '', // Optional for admin signup
      phone: '' // Optional for admin signup
    });
    
    if (result.success) {
      toast({
        title: "Account created successfully",
        description: "You can now sign in with your credentials.",
      });
      setView('login');
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


      <Button 
        type="submit" 
        className="w-full" 
        disabled={getCurrentLoadingState()}
      >
        {getCurrentLoadingState() && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign In to Admin Portal
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