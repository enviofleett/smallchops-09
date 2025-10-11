import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MoreHorizontal, Shield, Mail, Calendar, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/hooks/useRoleBasedPermissions';
import { formatDistanceToNow } from 'date-fns';
import { EditAdminDialog } from './EditAdminDialog';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-purple-500',
  store_owner: 'bg-indigo-500',
  admin_manager: 'bg-blue-500',
  account_manager: 'bg-cyan-500',
  support_staff: 'bg-green-500',
  admin: 'bg-blue-400',
  manager: 'bg-green-400',
  support_officer: 'bg-yellow-500',
  staff: 'bg-gray-500',
};

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

export function AdminUsersList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      // Fetch all admin users from user_roles table
      const rolesResult: any = await (supabase as any)
        .from('user_roles')
        .select('user_id, role, is_active')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false });

      if (rolesResult.error) throw rolesResult.error;

      // Get unique user IDs with admin roles
      const adminUserIds = rolesResult.data?.map((r: any) => r.user_id) || [];
      
      if (adminUserIds.length === 0) {
        return [];
      }

      // Fetch profiles for these users
      const profilesResult: any = await (supabase as any)
        .from('profiles')
        .select('id, email, name, is_active, created_at')
        .in('id', adminUserIds);

      if (profilesResult.error) throw profilesResult.error;

      // Fetch auth data for last sign in times
      const authResult: any = await (supabase as any).auth.admin.listUsers();

      // Create maps for quick lookup
      const roleMap = new Map<string, { role: UserRole; is_active: boolean }>();
      if (rolesResult.data) {
        rolesResult.data.forEach((r: any) => {
          roleMap.set(r.user_id, { role: r.role as UserRole, is_active: r.is_active });
        });
      }

      const authMap = new Map();
      if (authResult.data?.users) {
        authResult.data.users.forEach((u: any) => {
          authMap.set(u.id, u.last_sign_in_at);
        });
      }

      // Combine the data
      const result: AdminUser[] = [];
      if (profilesResult.data) {
        profilesResult.data.forEach((p: any) => {
          const roleData = roleMap.get(p.id);
          result.push({
            id: p.id,
            email: p.email || '',
            name: p.name || p.email || 'Unknown',
            role: roleData?.role || null,
            is_active: p.is_active && (roleData?.is_active ?? false),
            created_at: p.created_at,
            last_sign_in_at: authMap.get(p.id) || null,
          });
        });
      }

      return result;
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      toast({
        title: 'User deactivated',
        description: 'Admin user has been deactivated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate user',
        variant: 'destructive',
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      toast({
        title: 'User activated',
        description: 'Admin user has been activated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to activate user',
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

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {user.role ? (
                    <Badge className={roleColors[user.role]}>
                      <Shield className="h-3 w-3 mr-1" />
                      {roleLabels[user.role]}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">No role</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.is_active ? (
                    <Badge variant="outline" className="bg-green-50">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {user.last_sign_in_at ? (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditingUser(user)}>
                        Edit User
                      </DropdownMenuItem>
                      {user.is_active ? (
                        <DropdownMenuItem
                          onClick={() => deactivateMutation.mutate(user.id)}
                          className="text-destructive"
                        >
                          Deactivate User
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => activateMutation.mutate(user.id)}>
                          Activate User
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingUser && (
        <EditAdminDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
        />
      )}
    </>
  );
}
