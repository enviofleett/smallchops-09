import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Shield, Mail, Key, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreateAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateAdminDialog = ({ open, onOpenChange, onSuccess }: CreateAdminDialogProps) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [immediatePassword, setImmediatePassword] = useState('');
  const [useImmediateAccess, setUseImmediateAccess] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure we have at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special
    
    // Fill the rest randomly
    for (let i = 4; i < 14; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleGeneratePassword = () => {
    const newPassword = generatePassword();
    setImmediatePassword(newPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !role) {
      toast({
        title: 'Validation Error',
        description: 'Email and role are required',
        variant: 'destructive'
      });
      return;
    }

    if (useImmediateAccess && !immediatePassword) {
      toast({
        title: 'Validation Error', 
        description: 'Password is required for immediate access',
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-creator', {
        body: {
          email,
          role,
          immediate_password: useImmediateAccess ? immediatePassword : undefined,
          send_email: sendEmail,
          admin_created: true
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Admin Created Successfully',
          description: useImmediateAccess 
            ? `Admin user created with immediate access and auto-verified email. Password: ${data.data?.password || immediatePassword}`
            : 'Admin user created and invitation email sent',
        });

        // Reset form and close dialog
        setEmail('');
        setRole('admin');
        setImmediatePassword('');
        setUseImmediateAccess(false);
        setSendEmail(true);
        onOpenChange(false);
        onSuccess?.();
      } else if (data?.code === 'USER_EXISTS') {
        toast({
          title: 'User Already Exists',
          description: 'An account with this email already exists. You can set their role to admin instead.',
          variant: 'destructive'
        });
        return;
      } else {
        throw new Error(data?.error || 'Failed to create admin user');
      }
    } catch (error: any) {
      console.error('Admin creation error:', error);
      
      // Enhanced error handling for production
      let errorTitle = 'Creation Failed';
      let errorDescription = 'Failed to create admin user. Please try again.';
      
      if (error.message.includes('FunctionsHttpError')) {
        errorTitle = 'Server Error';
        errorDescription = 'Admin creation service is temporarily unavailable. Please try again in a moment.';
      } else if (error.message.includes('already exists')) {
        errorTitle = 'User Already Exists';
        errorDescription = 'An admin user with this email already exists. Please use a different email address.';
      } else if (error.message.includes('Invalid email')) {
        errorTitle = 'Invalid Email';
        errorDescription = 'Please enter a valid email address.';
      } else if (error.message.includes('Authorization')) {
        errorTitle = 'Permission Denied';
        errorDescription = 'You do not have permission to create admin users. Please contact a system administrator.';
      } else if (error.message.includes('Server configuration')) {
        errorTitle = 'System Configuration Error';
        errorDescription = 'The admin creation system is not properly configured. Please contact technical support.';
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Create Admin User
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Role
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Access Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Immediate Access</Label>
                <p className="text-sm text-muted-foreground">
                  Create user with password and auto-verify email for immediate login
                </p>
              </div>
              <Switch
                checked={useImmediateAccess}
                onCheckedChange={setUseImmediateAccess}
              />
            </div>

            {useImmediateAccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-green-800">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm font-medium">Immediate Access Enabled</span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  Email verification will be bypassed. User can login immediately with the provided password.
                </p>
              </div>
            )}

            {useImmediateAccess && (
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Password
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="text"
                    placeholder="Enter or generate password"
                    value={immediatePassword}
                    onChange={(e) => setImmediatePassword(e.target.value)}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGeneratePassword}
                  >
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  User should change this password after first login. Email will be auto-verified.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Send Welcome Email</Label>
                <p className="text-sm text-muted-foreground">
                  Send credentials and instructions via email
                </p>
              </div>
              <Switch
                checked={sendEmail}
                onCheckedChange={setSendEmail}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!email || !role || isCreating}
            >
              {isCreating ? 'Creating Admin...' : 'Create Admin User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};