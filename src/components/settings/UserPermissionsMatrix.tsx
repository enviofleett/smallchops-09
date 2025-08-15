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

  // Update currentUser when selectedUser prop changes
  useEffect(() => {
    if (selectedUser) {
      setCurrentUser(selectedUser);
    }
  }, [selectedUser]);

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
      // Use admin management edge function for better security and audit logging
      const { data, error } = await supabase.functions.invoke('admin-management', {
        body: {
          action: 'update_permissions',
          userId: currentUser.id,
          permissions: Object.fromEntries(
            Object.entries(permissions).filter(([_, level]) => level !== 'none')
          )
        }
      });

      if (error) throw error;

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
      <div key={menu.key} className={`${level > 0 ? 'ml-3 sm:ml-6 border-l-2 border-border pl-3 sm:pl-4' : ''}`}>
        <Card className="mb-3">
          <CardHeader className="pb-3 px-3 sm:px-6">
            <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="flex items-start space-x-2 sm:space-x-3 flex-1">
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(menu.key)}
                    className="p-1 h-6 w-6 sm:h-8 sm:w-8 mt-1 sm:mt-0 flex-shrink-0"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
                  </Button>
                )}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm sm:text-base break-words">{menu.label}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                    <span>Current:</span>
                    <Badge 
                      variant={
                        permissionLevels.find(p => p.value === permissions[menu.key])?.color as any || 'destructive'
                      }
                      className="text-xs w-fit"
                    >
                      {permissionLevels.find(p => p.value === permissions[menu.key])?.label || 'No Access'}
                    </Badge>
                  </CardDescription>
                </div>
              </div>
              <div className="w-full sm:w-48 flex-shrink-0">
                <Select
                  value={permissions[menu.key] || 'none'}
                  onValueChange={(value) => handlePermissionChange(menu.key, value)}
                >
                  <SelectTrigger className="w-full">
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
    <div className="space-y-4 sm:space-y-6">
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
            <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Shield className="w-5 h-5" />
                  Permissions for {currentUser.name}
                </CardTitle>
                <CardDescription className="text-sm">
                  Configure access levels for different sections and sub-sections
                </CardDescription>
              </div>
              <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
                <Badge variant="secondary" className="text-sm w-fit">
                  {currentUser.role}
                </Badge>
                <Button onClick={handleSavePermissions} disabled={isSubmitting} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Saving..." : "Save Permissions"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {menuStructure.map(menu => renderMenuPermissions(menu))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};