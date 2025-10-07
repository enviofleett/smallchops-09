import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ChangePassword() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  const checkPasswordStrength = (password: string) => {
    setPasswordStrength({
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  };

  const isPasswordStrong = Object.values(passwordStrength).every(Boolean);

  const handlePasswordChange = (password: string) => {
    setFormData(prev => ({ ...prev, newPassword: password }));
    checkPasswordStrength(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    if (!isPasswordStrong) {
      toast({
        title: 'Weak password',
        description: 'New password must meet all security requirements',
        variant: 'destructive',
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are identical',
        variant: 'destructive',
      });
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast({
        title: 'Same password',
        description: 'New password must be different from current password',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (updateError) throw updateError;

      // Update profile to mark password as changed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          must_change_password: false,
          password_changed_at: new Date().toISOString(),
          first_login_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Log password change
      await supabase.from('audit_logs').insert({
        action: 'password_changed',
        category: 'Security',
        message: 'User changed their password',
        user_id: user?.id,
      });

      toast({
        title: 'Password changed successfully',
        description: 'You can now access the admin dashboard',
      });

      // Redirect to dashboard
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Failed to change password',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-6 w-6 text-primary" />
            <CardTitle>Password Change Required</CardTitle>
          </div>
          <CardDescription>
            For security reasons, you must change your password before accessing the system. Please create a strong password that you'll remember.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Alert className="mb-6">
            <AlertDescription>
              <strong>Security Tip:</strong> Choose a unique password that you haven't used elsewhere. Your password will be encrypted and never shared.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password *</Label>
              <Input
                id="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter current password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Enter new secure password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              {formData.newPassword && (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="font-medium mb-2">Password Requirements:</p>
                  <div className="flex items-center gap-2">
                    {passwordStrength.length ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className={passwordStrength.length ? 'text-green-600' : 'text-muted-foreground'}>
                      At least 12 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {passwordStrength.uppercase ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className={passwordStrength.uppercase ? 'text-green-600' : 'text-muted-foreground'}>
                      One uppercase letter (A-Z)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {passwordStrength.lowercase ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className={passwordStrength.lowercase ? 'text-green-600' : 'text-muted-foreground'}>
                      One lowercase letter (a-z)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {passwordStrength.number ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className={passwordStrength.number ? 'text-green-600' : 'text-muted-foreground'}>
                      One number (0-9)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {passwordStrength.special ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className={passwordStrength.special ? 'text-green-600' : 'text-muted-foreground'}>
                      One special character (!@#$%^&*(),.?":{}|&lt;&gt;)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password *</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Re-enter new password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !isPasswordStrong}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password & Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
