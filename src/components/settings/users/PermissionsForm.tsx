
import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { menuSections, permissionLevels, PermissionLevel, MenuSection } from './types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

type PermissionsFormProps = {
  permissions: Record<MenuSection, PermissionLevel>;
  handlePermissionChange: (section: MenuSection, level: PermissionLevel) => void;
  loading: boolean;
};

const PermissionsForm = ({ permissions, handlePermissionChange, loading }: PermissionsFormProps) => {
  return (
    <div className="py-4 space-y-4 max-h-[40vh] overflow-y-auto pr-2">
      {menuSections.map((section) => (
        <div key={section} className="grid grid-cols-2 items-center gap-4">
          <Label htmlFor={`perm-${section}`} className="text-right">
            {capitalize(section)}
          </Label>
          <Select
            value={permissions[section] || "none"}
            onValueChange={(value: string) => handlePermissionChange(section, value as PermissionLevel)}
            disabled={loading}
          >
            <SelectTrigger id={`perm-${section}`} className="w-full">
              <SelectValue placeholder="Select permission" />
            </SelectTrigger>
            <SelectContent>
              {permissionLevels.map((level) => (
                <SelectItem key={level} value={level} className="capitalize">
                  {capitalize(level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
};

export default PermissionsForm;
