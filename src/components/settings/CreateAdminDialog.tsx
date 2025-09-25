import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Shield, Mail, Key, Users, UserPlus, RefreshCw, Settings } from 'lucide-react';
import { useAdminUserCreation } from '@/hooks/useAdminUserCreation';
interface CreateAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
export const CreateAdminDialog = ({
  open,
  onOpenChange,
  onSuccess
}: CreateAdminDialogProps) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [username, setUsername] = useState('');
  const [immediatePassword, setImmediatePassword] = useState('');
  const [useImmediateAccess, setUseImmediateAccess] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [passwordTemplate, setPasswordTemplate] = useState('secure_random');
  const [useAutoUsername, setUseAutoUsername] = useState(true);
  const [usernameFormat, setUsernameFormat] = useState<'full' | 'initials' | 'firstname'>('full');
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(true);
  const {
    createAdminUser,
    generateSecurePassword,
    generateUsernameFromEmailAddr,
    generatePasswordWithTemplate,
    getPasswordTemplates,
    isCreating
  } = useAdminUserCreation();
  const passwordTemplates = getPasswordTemplates();

  // Auto-generate username when email changes
  useEffect(() => {
    if (email && useAutoUsername) {
      const generatedUsername = generateUsernameFromEmailAddr(email, usernameFormat);
      setUsername(generatedUsername);
    }
  }, [email, useAutoUsername, usernameFormat, generateUsernameFromEmailAddr]);
  const handleGeneratePassword = () => {
    if (passwordTemplate === 'secure_random') {
      const newPassword = generateSecurePassword();
      setImmediatePassword(newPassword);
      setRequiresPasswordChange(false);
    } else {
      const {
        password,
        requiresChange
      } = generatePasswordWithTemplate(passwordTemplate, {
        email,
        username: username || generateUsernameFromEmailAddr(email, usernameFormat)
      });
      setImmediatePassword(password);
      setRequiresPasswordChange(requiresChange);
    }
  };
  const handleTemplateChange = (templateId: string) => {
    setPasswordTemplate(templateId);
    if (useImmediateAccess && email) {
      const {
        password,
        requiresChange
      } = generatePasswordWithTemplate(templateId, {
        email,
        username: username || generateUsernameFromEmailAddr(email, usernameFormat)
      });
      setImmediatePassword(password);
      setRequiresPasswordChange(requiresChange);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation
    if (!email?.trim()) {
      return;
    }
    
    if (!role) {
      return;
    }
    
    if (useImmediateAccess && !immediatePassword?.trim()) {
      return;
    }
    
    const result = await createAdminUser({
      email: email.trim(),
      role: role as 'admin' | 'user',
      immediate_password: useImmediateAccess ? immediatePassword : undefined,
      username: username?.trim() || generateUsernameFromEmailAddr(email, usernameFormat),
      password_template: passwordTemplate,
      requires_password_change: requiresPasswordChange,
      send_email: sendEmail,
      admin_created: true
    });
    
    if (result.success) {
      // Reset form and close dialog
      setEmail('');
      setRole('admin');
      setUsername('');
      setImmediatePassword('');
      setUseImmediateAccess(false);
      setSendEmail(true);
      setPasswordTemplate('secure_random');
      setUseAutoUsername(true);
      setUsernameFormat('full');
      setRequiresPasswordChange(true);
      onOpenChange(false);
      onSuccess?.();
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Input id="email" type="email" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
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

            {/* Username Configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Auto-generate Username
                </Label>
                <Switch checked={useAutoUsername} onCheckedChange={setUseAutoUsername} />
              </div>

              {useAutoUsername && <div className="space-y-2">
                  <Label htmlFor="username-format">Username Format</Label>
                  <Select value={usernameFormat} onValueChange={(value: 'full' | 'initials' | 'firstname') => setUsernameFormat(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full (john.doe)</SelectItem>
                      <SelectItem value="firstname">First Name (john)</SelectItem>
                      <SelectItem value="initials">Initials (jd)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>}

              {!useAutoUsername && <div className="space-y-2">
                  <Label htmlFor="username">Custom Username</Label>
                  <Input id="username" type="text" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} />
                </div>}

              {username && <div className="flex items-center gap-2">
                  <Badge variant="outline">Username: {username}</Badge>
                </div>}
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
              <Switch checked={useImmediateAccess} onCheckedChange={setUseImmediateAccess} />
            </div>

            {useImmediateAccess}

            {useImmediateAccess && <div className="space-y-4">
                {/* Password Template Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Password Template
                  </Label>
                  <Select value={passwordTemplate} onValueChange={handleTemplateChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {passwordTemplates.map(template => <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col">
                            <span>{template.name}</span>
                            <span className="text-xs text-muted-foreground">{template.description}</span>
                          </div>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Password
                  </Label>
                  <div className="flex gap-2">
                    <Input id="password" type="text" placeholder="Enter or generate password" value={immediatePassword} onChange={e => setImmediatePassword(e.target.value)} className="font-mono" />
                    <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Password Change Requirement */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Require Password Change</Label>
                    <p className="text-xs text-muted-foreground">
                      Force user to change password on first login
                    </p>
                  </div>
                  <Switch checked={requiresPasswordChange} onCheckedChange={setRequiresPasswordChange} />
                </div>

                {requiresPasswordChange}
              </div>}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Send Welcome Email</Label>
                <p className="text-sm text-muted-foreground">
                  Send credentials and instructions via email
                </p>
              </div>
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={!email?.trim() || !role || (useImmediateAccess && !immediatePassword?.trim()) || isCreating}>
              {isCreating ? 'Creating Admin...' : 'Create Admin User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>;
};