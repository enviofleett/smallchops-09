
import { Constants } from "@/integrations/supabase/types";

export type UserStatus = 'active' | 'inactive' | 'pending';
export type UserRole = 'admin' | 'manager' | 'staff';

export type User = {
  id: string;
  email?: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string | null;
  created_at: string;
};

export type MenuSection = typeof Constants.public.Enums.menu_section[number];
export type PermissionLevel = 'none' | 'view' | 'edit';

export const menuSections: readonly MenuSection[] = Constants.public.Enums.menu_section;
export const permissionLevels: PermissionLevel[] = ["none", "view", "edit"];

export const getInitialPermissions = (): Record<MenuSection, PermissionLevel> => {
  return menuSections.reduce((acc, section) => {
    acc[section] = "none";
    return acc;
  }, {} as Record<MenuSection, PermissionLevel>);
};
