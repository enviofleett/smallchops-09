import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, ChevronDown, ChevronRight } from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  role: string;
}

interface MenuStructure {
  id: string;
  key: string;
  label: string;
  parent_key: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  permission_levels: any;
  children?: MenuStructure[];
}

interface UserPermission {
  id: string;
  user_id: string;
  menu_key: string;
  permission_level: string;
}

interface UserPermissionsMatrixProps {
  selectedUser?: AdminUser | null;
}

const permissionLevels = [
  { value: 'none', label: 'No Access', color: 'destructive' },
  { value: 'view', label: 'View Only', color: 'secondary' },
  { value: 'edit', label: 'Full Access', color: 'default' },
];

export const UserPermissionsMatrix = ({ selectedUser }: UserPermissionsMatrixProps) => {
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(selectedUser || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch admin users
  const { data: adminUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('role', ['admin', 'manager']);
      
      if (error) throw error;
      return data as AdminUser[];
    }
  });

  // Fetch menu structure
  const { data: menuStructure } = useQuery({
    queryKey: ['menu-structure'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_structure')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      // Organize into hierarchical structure
      const menus: MenuStructure[] = [];
      const menuMap = new Map<string, MenuStructure>();

      data.forEach(menu => {
        const menuItem: MenuStructure = {
          ...menu,
          children: []
        };
        menuMap.set(menu.key, menuItem);
      });

      data.forEach(menu => {
        if (menu.parent_key) {
          const parent = menuMap.get(menu.parent_key);
          if (parent) {
            parent.children!.push(menuMap.get(menu.key)!);
          }
        } else {
          menus.push(menuMap.get(menu.key)!);
        }
      });

      return menus;
    },
  });

  // Fetch user permissions
  const { data: userPermissions, refetch: refetchPermissions } = useQuery({
    queryKey: ['user-permissions', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', currentUser.id);
      
      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!currentUser?.id
  });

  // Update local permissions state when data loads
  useEffect(() => {
    if (userPermissions && menuStructure) {
      const permissionMap: Record<string, string> = {};
      
      // Collect all menu keys (including sub-menus)
      const getAllMenuKeys = (menus: MenuStructure[]): string[] => {
        let keys: string[] = [];
        menus.forEach(menu => {
          keys.push(menu.key);
          if (menu.children) {
            keys = keys.concat(getAllMenuKeys(menu.children));
          }
        });
        return keys;
      };

      const allKeys = getAllMenuKeys(menuStructure);
      
      // Initialize all keys with 'none'
      allKeys.forEach(key => {
        permissionMap[key] = 'none';
      });
      
      // Update with actual permissions
      userPermissions.forEach(permission => {
        if (permission.menu_key) {
          permissionMap[permission.menu_key] = permission.permission_level;
        }
      });
      
      setPermissions(permissionMap);
    }
  }, [userPermissions, menuStructure]);

  const handlePermissionChange = (menuKey: string, level: string) => {
    setPermissions(prev => ({
      ...prev,
      [menuKey]: level
    }));
  };

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedMenus(newExpanded);
  };

  const handleSavePermissions = async () => {
    if (!currentUser?.id) return;
    
    setIsSubmitting(true);
    try {
      // Delete existing permissions for this user
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', currentUser.id);

      // Insert new permissions (only non-'none' permissions)
      const permissionsToInsert = Object.entries(permissions)
        .filter(([_, level]) => level !== 'none')
        .map(([menuKey, level]) => ({
          user_id: currentUser.id,
          menu_key: menuKey,
          menu_section: 'dashboard' as any, // Default value since this is legacy field
          permission_level: level as any,
        }));

      if (permissionsToInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Permissions updated",
        description: `Permissions have been updated for ${currentUser.name}`,
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

  const renderMenuPermissions = (menu: MenuStructure, level = 0) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const isExpanded = expandedMenus.has(menu.key);

    return (
      <div key={menu.key} className={`${level > 0 ? 'ml-6 border-l-2 border-border pl-4' : ''}`}>
        <Card className="mb-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(menu.key)}
                    className="p-1 h-8 w-8"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                )}
                <div className="flex-1">
                  <CardTitle className="text-base">{menu.label}</CardTitle>
                  <CardDescription className="text-sm flex items-center gap-2">
                    Current: 
                    <Badge 
                      variant={
                        permissionLevels.find(p => p.value === permissions[menu.key])?.color as any || 'destructive'
                      }
                      className="text-xs"
                    >
                      {permissionLevels.find(p => p.value === permissions[menu.key])?.label || 'No Access'}
                    </Badge>
                  </CardDescription>
                </div>
              </div>
              <div className="w-48">
                <Select
                  value={permissions[menu.key] || 'none'}
                  onValueChange={(value) => handlePermissionChange(menu.key, value)}
                >
                  <SelectTrigger>
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
              </div>
            </div>
          </CardHeader>
        </Card>

        {hasChildren && (
          <Collapsible open={isExpanded}>
            <CollapsibleContent>
              <div className="space-y-2">
                {menu.children!.map(child => renderMenuPermissions(child, level + 1))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
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
    <div className="space-y-6">
      {!selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle>Select User</CardTitle>
            <CardDescription>Choose an admin user to manage their permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={currentUser?.id || ''}
              onValueChange={(value) => {
                const user = adminUsers?.find(u => u.id === value);
                setCurrentUser(user || null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an admin user..." />
              </SelectTrigger>
              <SelectContent>
                {adminUsers?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || 'Unnamed Admin'} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {currentUser && menuStructure && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Permissions for {currentUser.name}
            </CardTitle>
            <CardDescription>
              Configure access levels for different sections and sub-sections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-sm">
                  {currentUser.role}
                </Badge>
                <Button onClick={handleSavePermissions} disabled={isSubmitting} size="lg">
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Saving..." : "Save Permissions"}
                </Button>
              </div>
              
              <div className="space-y-4">
                {menuStructure.map(menu => renderMenuPermissions(menu))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};