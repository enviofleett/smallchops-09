import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthFormValidation from '@/components/auth/AuthFormValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, Loader2, CheckCircle } from 'lucide-react';

const PasswordResetPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const type = searchParams.get('type');
      
      if (!accessToken || !refreshToken || type !== 'recovery') {
        setIsValidToken(false);
        return;
      }

      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('Token validation error:', error);
          setIsValidToken(false);
          return;
        }

        setIsValidToken(true);
      } catch (error) {
        console.error('Session setup error:', error);
        setIsValidToken(false);
      }
    };

    checkToken();
  }, [searchParams]);

  const validatePasswords = () => {
    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return false;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswords()) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setResetComplete(true);
      
      toast({
        title: "Password updated!",
        description: "Your password has been successfully changed.",
      });

      // Auto-redirect after success
      setTimeout(() => {
        navigate('/auth?view=login');
      }, 3000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Reset failed",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <AuthLayout title="Password Reset" subtitle="Validating reset link">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" />
          <p className="text-muted-foreground mt-2">Checking reset link...</p>
        </div>
      </AuthLayout>
    );
  }

  if (!isValidToken) {
    return (
      <AuthLayout title="Invalid Reset Link" subtitle="This link has expired or is invalid">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            The password reset link is invalid or has expired.
          </p>
          <Button onClick={() => navigate('/auth?view=forgot-password')} className="w-full">
            Request New Reset Link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (resetComplete) {
    return (
      <AuthLayout title="Password Updated" subtitle="Your password has been successfully changed">
        <div className="text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
          <div>
            <h3 className="text-lg font-semibold text-green-700">Success!</h3>
            <p className="text-muted-foreground">
              Your password has been updated. You can now sign in with your new password.
            </p>
          </div>
          <Button onClick={() => navigate('/auth')} className="w-full">
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set New Password" subtitle="Choose a strong password for your account">
      <form onSubmit={handlePasswordReset} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
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

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
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

        {password && (
          <AuthFormValidation
            password={password}
            confirmPassword={confirmPassword}
            showValidation={true}
          />
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Password
        </Button>
      </form>
    </AuthLayout>
  );
};

export default PasswordResetPage;