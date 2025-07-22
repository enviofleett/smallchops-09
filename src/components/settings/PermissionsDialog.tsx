
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import type { UserPermission } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MenuSection,
  PermissionLevel,
  menuSections,
  permissionLevels,
  getInitialPermissions,
} from './users/types';

type User = {
  id: string;
  name: string | null;
  email?: string;
};

type PermissionsDialogProps = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const PermissionsDialog = ({ user, open, onOpenChange, onSuccess }: PermissionsDialogProps) => {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Record<MenuSection, PermissionLevel>>(getInitialPermissions());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && open) {
      const fetchPermissions = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke(`user-management?userId=${user.id}`, {
            method: 'GET',
          });
          if (error || data.error) throw new Error(error?.message || data.error.message);
          
          const userPermissions: UserPermission[] = data.data;
          const permsMap = getInitialPermissions();
          
          userPermissions.forEach(p => {
            if (p.menu_section && p.permission_level) {
                permsMap[p.menu_section] = p.permission_level as PermissionLevel;
            }
          });
          
          setPermissions(permsMap);
        } catch (err: any) {
          toast({ title: "Error fetching permissions", description: err.message, variant: 'destructive' });
        }
        setLoading(false);
      };
      fetchPermissions();
    } else if (!open) {
      setPermissions(getInitialPermissions());
    }
  }, [user, open, toast]);

  const handlePermissionChange = (section: MenuSection, level: PermissionLevel) => {
    setPermissions(prev => ({ ...prev, [section]: level }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const permissionsToSave = Object.entries(permissions)
        .filter(([, level]) => level !== 'none')
        .map(([section, level]) => ({
          menu_section: section as MenuSection,
          permission_level: level as 'view' | 'edit',
        }));
      
      const { data, error } = await supabase.functions.invoke('user-management', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_permissions',
          userId: user.id,
          permissions: permissionsToSave
        }),
      });

      if (error || data.error) throw new Error(error?.message || data.error.message);

      toast({ title: "Permissions updated successfully!" });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error saving permissions", description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };
  
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Permissions for {user?.name}</DialogTitle>
          <DialogDescription>
            Set menu access and permissions for {user?.email}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-2 items-center gap-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))
          ) : 
          menuSections.map(section => (
            <div key={section} className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor={`perm-${section}`} className="text-right">
                {capitalize(section)}
              </Label>
              <Select
                value={permissions[section] || 'none'}
                onValueChange={(value: string) => handlePermissionChange(section, value as PermissionLevel)}
              >
                <SelectTrigger id={`perm-${section}`} className="w-full">
                  <SelectValue placeholder="Select permission" />
                </SelectTrigger>
                <SelectContent>
                  {permissionLevels.map(level => (
                    <SelectItem key={level} value={level} className="capitalize">
                      {capitalize(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionsDialog;
