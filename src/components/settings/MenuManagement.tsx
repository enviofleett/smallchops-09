import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useErrorHandler } from "@/hooks/useErrorHandler";

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

export const MenuManagement = () => {
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [editingMenu, setEditingMenu] = useState<string | null>(null);
  const [newMenuData, setNewMenuData] = useState({
    key: "",
    label: "",
    parent_key: "none",
    sort_order: 0,
  });

  const { toast } = useToast();
  const { handleError } = useErrorHandler();
  const queryClient = useQueryClient();

  const { data: menuStructure, isLoading } = useQuery({
    queryKey: ['menu-structure'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_structure')
        .select('*')
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

  const addMenuMutation = useMutation({
    mutationFn: async (menuData: typeof newMenuData) => {
      const sanitizedData = {
        ...menuData,
        parent_key: menuData.parent_key === 'none' ? null : menuData.parent_key
      };
      const { error } = await supabase
        .from('menu_structure')
        .insert(sanitizedData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-structure'] });
      setNewMenuData({ key: "", label: "", parent_key: "none", sort_order: 0 });
      toast({ title: "Menu added successfully" });
    },
    onError: (error) => handleError(error, "adding menu"),
  });

  const updateMenuMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MenuStructure> }) => {
      const { error } = await supabase
        .from('menu_structure')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-structure'] });
      setEditingMenu(null);
      toast({ title: "Menu updated successfully" });
    },
    onError: (error) => handleError(error, "updating menu"),
  });

  const deleteMenuMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_structure')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-structure'] });
      toast({ title: "Menu deleted successfully" });
    },
    onError: (error) => handleError(error, "deleting menu"),
  });

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedMenus(newExpanded);
  };

  const renderMenu = (menu: MenuStructure, level = 0) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const isExpanded = expandedMenus.has(menu.key);

    return (
      <div key={menu.id} className={`${level > 0 ? 'ml-6' : ''}`}>
        <Card className="mb-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(menu.key)}
                    className="p-1 h-6 w-6"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                )}
                <div>
                  <CardTitle className="text-sm">{menu.label}</CardTitle>
                  <CardDescription className="text-xs">Key: {menu.key}</CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={menu.is_active ? "default" : "secondary"}>
                  {menu.is_active ? "Active" : "Inactive"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingMenu(menu.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMenuMutation.mutate(menu.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {hasChildren && (
          <Collapsible open={isExpanded}>
            <CollapsibleContent>
              {menu.children!.map(child => renderMenu(child, level + 1))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div>Loading menu structure...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Menu</CardTitle>
          <CardDescription>Create a new menu item or sub-menu</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="key">Menu Key</Label>
              <Input
                id="key"
                value={newMenuData.key}
                onChange={(e) => setNewMenuData({ ...newMenuData, key: e.target.value })}
                placeholder="e.g., inventory_management"
              />
            </div>
            <div>
              <Label htmlFor="label">Display Label</Label>
              <Input
                id="label"
                value={newMenuData.label}
                onChange={(e) => setNewMenuData({ ...newMenuData, label: e.target.value })}
                placeholder="e.g., Inventory Management"
              />
            </div>
            <div>
              <Label htmlFor="parent">Parent Menu</Label>
              <Select
                value={newMenuData.parent_key}
                onValueChange={(value) => setNewMenuData({ ...newMenuData, parent_key: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Main Menu)</SelectItem>
                  {menuStructure?.map((menu) => (
                    <SelectItem key={menu.key} value={menu.key}>
                      {menu.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={newMenuData.sort_order}
                onChange={(e) => setNewMenuData({ ...newMenuData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <Button
            onClick={() => addMenuMutation.mutate(newMenuData)}
            disabled={!newMenuData.key || !newMenuData.label}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Menu
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Menu Structure</CardTitle>
          <CardDescription>Manage your application's menu structure and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {menuStructure?.map(menu => renderMenu(menu))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};