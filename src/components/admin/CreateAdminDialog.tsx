import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserManagement } from '@/hooks/useUserManagement';
import { Loader2 } from 'lucide-react';
import { UserRole } from '@/hooks/useRoleBasedPermissions';

interface CreateAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  support_officer: 'Support Officer',
  staff: 'Staff',
};

export function CreateAdminDialog({ open, onOpenChange }: CreateAdminDialogProps) {
  const { toast } = useToast();
  const { createUserInvitation, isLoading } = useUserManagement();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('admin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !name) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createUserInvitation({
        email,
        name,
        role,
      });

      toast({
        title: 'Invitation sent',
        description: `An invitation has been sent to ${email}`,
      });

      setEmail('');
      setName('');
      setRole('admin');
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Admin User</DialogTitle>
          <DialogDescription>
            Send an invitation to create a new admin user account
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">{roleLabels.super_admin}</SelectItem>
                  <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                  <SelectItem value="manager">{roleLabels.manager}</SelectItem>
                  <SelectItem value="support_officer">{roleLabels.support_officer}</SelectItem>
                  <SelectItem value="staff">{roleLabels.staff}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
