import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/hooks/useRoleBasedPermissions';

interface UserWithRole {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  is_active: boolean;
}

interface ProfileRow {
  id: string;
  email: string | null;
  name: string | null;
  is_active: boolean | null;
}

interface RoleRow {
  user_id: string;
  role: string;
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  support_officer: 'Support Officer',
  staff: 'Staff',
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-purple-500',
  admin: 'bg-blue-500',
  manager: 'bg-green-500',
  support_officer: 'bg-yellow-500',
  staff: 'bg-gray-500',
};

export function UserRoleAssignment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, UserRole>>({});

  const { data: users, isLoading } = useQuery<UserWithRole[]>({
    queryKey: ['admin-users-with-roles'],
    queryFn: async () => {
      // Fetch profiles
      const profilesResult: any = await (supabase as any)
        .from('profiles')
        .select('id, email, name, is_active')
        .eq('user_type', 'admin')
        .order('email');

      if (profilesResult.error) throw profilesResult.error;

      // Fetch roles  
      const rolesResult: any = await (supabase as any)
        .from('user_roles')
        .select('user_id, role')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()');

      if (rolesResult.error) throw rolesResult.error;

      const roleMap = new Map<string, UserRole>();
      if (rolesResult.data) {
        rolesResult.data.forEach((r: any) => {
          roleMap.set(r.user_id, r.role as UserRole);
        });
      }

      const result: UserWithRole[] = [];
      if (profilesResult.data) {
        profilesResult.data.forEach((p: any) => {
          result.push({
            id: p.id,
            email: p.email || '',
            name: p.name || p.email || 'Unknown',
            role: roleMap.get(p.id) || null,
            is_active: p.is_active || false,
          });
        });
      }

      return result;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const { data, error } = await supabase.functions.invoke('role-management-v2', {
        body: { userId, newRole },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-with-roles'] });
      toast({
        title: 'Role updated',
        description: 'User role has been updated successfully',
      });
      setPendingChanges({});
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating role',
        description: error.message || 'Failed to update user role',
        variant: 'destructive',
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    setPendingChanges(prev => ({ ...prev, [userId]: newRole }));
  };

  const handleSaveChanges = (userId: string) => {
    const newRole = pendingChanges[userId];
    if (newRole) {
      updateRoleMutation.mutate({ userId, newRole });
    }
  };

  const hasPendingChanges = (userId: string) => {
    return userId in pendingChanges;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Current Role</TableHead>
              <TableHead>Assign Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {user.role ? (
                    <Badge className={roleColors[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">No role assigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={(pendingChanges[user.id] || user.role || '') as string}
                    onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="support_officer">Support Officer</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {user.is_active ? (
                    <Badge variant="outline" className="bg-green-50">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    onClick={() => handleSaveChanges(user.id)}
                    disabled={!hasPendingChanges(user.id) || updateRoleMutation.isPending}
                  >
                    {updateRoleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
