import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save } from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  role: string;
}

interface UserPermission {
  id: string;
  user_id: string;
  menu_section: string;
  permission_level: string;
}

interface UserPermissionsMatrixProps {
  selectedUser?: AdminUser | null;
}

const menuSections = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Orders' },
  { key: 'categories', label: 'Categories' },
  { key: 'products', label: 'Products' },
  { key: 'customers', label: 'Customers' },
  { key: 'delivery_pickup', label: 'Delivery & Pickup' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
  { key: 'audit_logs', label: 'Audit Logs' },
];

const permissionLevels = [
  { value: 'none', label: 'None', color: 'destructive' },
  { value: 'view', label: 'View', color: 'secondary' },
  { value: 'edit', label: 'Edit', color: 'default' },
];

export const UserPermissionsMatrix = ({ selectedUser }: UserPermissionsMatrixProps) => {
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('role', 'admin');
      
      if (error) throw error;
      return data as AdminUser[];
    }
  });

  const { data: userPermissions, refetch: refetchPermissions } = useQuery({
    queryKey: ['user-permissions', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser?.id) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', selectedUser.id);
      
      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!selectedUser?.id
  });

  useEffect(() => {
    if (userPermissions) {
      const permissionsMap: Record<string, string> = {};
      userPermissions.forEach(permission => {
        permissionsMap[permission.menu_section] = permission.permission_level;
      });
      
      // Set default permissions for sections not yet configured
      menuSections.forEach(section => {
        if (!permissionsMap[section.key]) {
          permissionsMap[section.key] = 'none';
        }
      });
      
      setPermissions(permissionsMap);
    }
  }, [userPermissions]);

  const handlePermissionChange = (menuSection: string, level: string) => {
    setPermissions(prev => ({
      ...prev,
      [menuSection]: level
    }));
  };

  const handleSavePermissions = async () => {
    if (!selectedUser?.id) return;
    
    setIsSubmitting(true);
    try {
      // Delete existing permissions for this user
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.id);

      // Insert new permissions
      const permissionsToInsert = Object.entries(permissions)
        .filter(([_, level]) => level !== 'none')
        .map(([menuSection, permissionLevel]) => ({
          user_id: selectedUser.id,
          menu_section: menuSection as any,
          permission_level: permissionLevel as any
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Permissions updated",
        description: `Permissions have been updated for ${selectedUser.name}`,
      });

      refetchPermissions();
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedUser && (!adminUsers || adminUsers.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            User Permissions Matrix
          </CardTitle>
          <CardDescription>
            No admin users found. Create admin users first to manage their permissions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          User Permissions Matrix
        </CardTitle>
        <CardDescription>
          Configure menu and feature permissions for admin users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!selectedUser && (
          <div>
            <label className="text-sm font-medium">Select Admin User</label>
            <Select onValueChange={(value) => {
              const user = adminUsers?.find(u => u.id === value);
              if (user) {
                // This would need to be handled by parent component
                console.log('Selected user:', user);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an admin user" />
              </SelectTrigger>
              <SelectContent>
                {adminUsers?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || 'Unnamed Admin'} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {selectedUser && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                <Badge variant="secondary">{selectedUser.role}</Badge>
              </div>
              <Button onClick={handleSavePermissions} disabled={isSubmitting}>
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? "Saving..." : "Save Permissions"}
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu Section</TableHead>
                    <TableHead>Permission Level</TableHead>
                    <TableHead>Current Setting</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menuSections.map((section) => (
                    <TableRow key={section.key}>
                      <TableCell className="font-medium">{section.label}</TableCell>
                      <TableCell>
                        <Select
                          value={permissions[section.key] || 'none'}
                          onValueChange={(value) => handlePermissionChange(section.key, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {permissionLevels.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            permissionLevels.find(l => l.value === permissions[section.key])?.color as any || 'destructive'
                          }
                        >
                          {permissionLevels.find(l => l.value === permissions[section.key])?.label || 'None'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};