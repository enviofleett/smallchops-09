import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Key, Mail, RefreshCw, AlertTriangle, Copy, Shield, User } from 'lucide-react';
import { useAdminPasswordReset } from '@/hooks/useAdminPasswordReset';
import { toast } from 'sonner';

interface AdminPasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  onSuccess?: () => void;
}

export const AdminPasswordResetDialog = ({
  open,
  onOpenChange,
  adminUser,
  onSuccess
}: AdminPasswordResetDialogProps) => {
  const [resetMethod, setResetMethod] = useState<'temporary_password' | 'reset_link'>('reset_link');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { resetAdminPassword, generateSecurePassword, isResetting } = useAdminPasswordReset();

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword();
    setTemporaryPassword(newPassword);
    setGeneratedPassword(newPassword);
    setShowPassword(true);
  };

  const copyPasswordToClipboard = async () => {
    if (generatedPassword) {
      try {
        await navigator.clipboard.writeText(generatedPassword);
        toast.success('Password copied to clipboard');
      } catch (error) {
        console.error('Failed to copy password:', error);
        toast.error('Failed to copy password');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminUser) {
      toast.error('No admin user selected');
      return;
    }

    if (resetMethod === 'temporary_password' && !temporaryPassword.trim()) {
      toast.error('Please provide a temporary password or generate one');
      return;
    }

    const result = await resetAdminPassword({
      targetUserId: adminUser.id,
      resetMethod,
      temporaryPassword: resetMethod === 'temporary_password' ? temporaryPassword : undefined
    });

    if (result.success) {
      // Update the generated password if one was returned
      if (result.data?.temporaryPassword) {
        setGeneratedPassword(result.data.temporaryPassword);
        setShowPassword(true);
      }
      
      // Keep dialog open to show the generated password
      if (resetMethod === 'reset_link') {
        onOpenChange(false);
        onSuccess?.();
      }
    }
  };

  const handleClose = () => {
    setResetMethod('reset_link');
    setTemporaryPassword('');
    setGeneratedPassword('');
    setShowPassword(false);
    onOpenChange(false);
  };

  if (!adminUser) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Key className="h-5 w-5 text-destructive" />
            </div>
            Reset Admin Password
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Admin User Info */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Target Admin User</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Name:</span>
                  <span className="font-medium">{adminUser.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="font-medium">{adminUser.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Role:</span>
                  <Badge variant="secondary">{adminUser.role}</Badge>
                </div>
              </div>
            </div>

            {/* Security Warning */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Security Notice:</strong> This action will immediately change the admin user's password. 
                Make sure to securely communicate the new credentials if using temporary password method.
              </AlertDescription>
            </Alert>

            {/* Reset Method Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Reset Method</Label>
              <div className="space-y-4">
                <div className="space-y-4">
                  <div 
                    className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      resetMethod === 'reset_link' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setResetMethod('reset_link')}
                  >
                    <input 
                      type="radio" 
                      id="reset_link" 
                      name="resetMethod"
                      checked={resetMethod === 'reset_link'}
                      onChange={() => setResetMethod('reset_link')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="reset_link" className="flex items-center gap-2 font-medium cursor-pointer">
                        <Mail className="h-4 w-4" />
                        Send Reset Link
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Send a secure password reset link to the admin's email address. They can reset their own password.
                      </p>
                    </div>
                  </div>

                  <div 
                    className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      resetMethod === 'temporary_password' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setResetMethod('temporary_password')}
                  >
                    <input 
                      type="radio" 
                      id="temporary_password" 
                      name="resetMethod"
                      checked={resetMethod === 'temporary_password'}
                      onChange={() => setResetMethod('temporary_password')}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <Label htmlFor="temporary_password" className="flex items-center gap-2 font-medium cursor-pointer">
                        <Key className="h-4 w-4" />
                        Set Temporary Password
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Immediately set a new password that must be changed on next login. Use for urgent access.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Temporary Password Section */}
            {resetMethod === 'temporary_password' && (
              <div className="space-y-4">
                <Separator />
                <div className="space-y-3">
                  <Label htmlFor="temp-password" className="flex items-center gap-2 text-sm font-medium">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    Temporary Password
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="temp-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter temporary password"
                      value={temporaryPassword}
                      onChange={e => setTemporaryPassword(e.target.value)}
                      className="font-mono h-11 flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleGeneratePassword}
                      className="h-11 px-3"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {generatedPassword && showPassword && (
                    <div className="p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Generated Password:</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={copyPasswordToClipboard}
                          className="h-auto p-1"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <code className="text-sm font-mono bg-background p-2 rounded border block">
                        {generatedPassword}
                      </code>
                      <p className="text-xs text-muted-foreground mt-2">
                        Admin will be required to change this password on next login.
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Password must be at least 8 characters long. Use the generate button for a secure password.
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30 mt-auto">
            <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={isResetting}
                className="flex-1 sm:flex-initial h-11"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isResetting || (resetMethod === 'temporary_password' && !temporaryPassword.trim())}
                className="flex-1 sm:flex-initial h-11 font-medium"
                variant="destructive"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    {resetMethod === 'reset_link' ? 'Send Reset Link' : 'Set New Password'}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
