import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/hooks/useRoleBasedPermissions';
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CreateAdminUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  store_owner: 'Store Owner',
  admin_manager: 'Admin Manager',
  account_manager: 'Account Manager',
  support_staff: 'Support Staff',
  admin: 'Admin (Legacy)',
  manager: 'Manager (Legacy)',
  support_officer: 'Support Officer (Legacy)',
  staff: 'Staff (Legacy)',
};

// Only allow creation of new roles
const CREATABLE_ROLES: UserRole[] = ['super_admin', 'store_owner', 'admin_manager', 'account_manager', 'support_staff'];

export function CreateAdminUserDialog({ open, onOpenChange, onSuccess }: CreateAdminUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    username: '',
    role: '' as UserRole,
    password: '',
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

  const handleEmailChange = (email: string) => {
    setFormData(prev => ({
      ...prev,
      email,
      username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
    }));
  };

  const handlePasswordChange = (password: string) => {
    setFormData(prev => ({ ...prev, password }));
    checkPasswordStrength(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.name || !formData.role || !formData.password) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (!isPasswordStrong) {
      toast({
        title: 'Weak password',
        description: 'Password must meet all security requirements',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are identical',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-creator', {
        body: {
          email: formData.email,
          name: formData.name,
          username: formData.username,
          role: formData.role,
          password: formData.password,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create admin user');
      }

      toast({
        title: 'Admin user created',
        description: `${formData.name} has been created successfully with role: ${roleLabels[formData.role]}`,
      });

      setFormData({
        email: '',
        name: '',
        username: '',
        role: '' as UserRole,
        password: '',
        confirmPassword: '',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating admin user:', error);
      toast({
        title: 'Failed to create admin user',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Admin User</DialogTitle>
          <DialogDescription>
            Create a new admin user with secure credentials. The user will be required to change their password on first login.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() }))}
              placeholder="johndoe"
              required
            />
            <p className="text-xs text-muted-foreground">Auto-generated from email, can be customized</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as UserRole }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {CREATABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Initial Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Enter secure password"
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

            {formData.password && (
              <div className="mt-2 space-y-1 text-xs">
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
                    One uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.lowercase ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className={passwordStrength.lowercase ? 'text-green-600' : 'text-muted-foreground'}>
                    One lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.number ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className={passwordStrength.number ? 'text-green-600' : 'text-muted-foreground'}>
                    One number
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.special ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className={passwordStrength.special ? 'text-green-600' : 'text-muted-foreground'}>
                    One special character
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Re-enter password"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !isPasswordStrong}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Admin User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
