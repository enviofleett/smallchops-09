import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Clock, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { UserRole } from '@/hooks/useRoleBasedPermissions';

interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  invited_at: string;
  expires_at: string;
  invited_by: string;
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  store_owner: 'Store Owner',
  admin_manager: 'Admin Manager',
  account_manager: 'Account Manager',
  support_staff: 'Support Staff',
  fulfilment_support: 'Fulfilment Support',
  admin: 'Admin (Legacy)',
  manager: 'Manager (Legacy)',
  support_officer: 'Support Officer (Legacy)',
  staff: 'Staff (Legacy)',
};

export function AdminInvitations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invitations, isLoading } = useQuery<Invitation[]>({
    queryKey: ['admin-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_invitations')
        .select('*')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('invited_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('admin_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      toast({
        title: 'Invitation revoked',
        description: 'The invitation has been revoked successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke invitation',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!invitations || invitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No pending invitations</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invited</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {invitation.email}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{roleLabels[invitation.role]}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{invitation.status}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(invitation.invited_at), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeMutation.mutate(invitation.id)}
                  disabled={revokeMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
