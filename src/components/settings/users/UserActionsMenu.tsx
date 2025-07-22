
import React from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Edit, Power, UserX } from "lucide-react";
import { User } from './types';

type UserActionsMenuProps = {
  user: User;
  onEditPermissions: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onDelete: (user: User) => void;
};

const UserActionsMenu = ({ user, onEditPermissions, onToggleStatus, onDelete }: UserActionsMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEditPermissions(user)}>
          <Edit className="mr-2 h-4 w-4" /> Edit Permissions
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleStatus(user)}>
          {user.status === 'active' ? (
            <UserX className="mr-2 h-4 w-4" />
          ) : (
            <Power className="mr-2 h-4 w-4" />
          )}
          <span>{user.status === 'active' ? 'Deactivate' : 'Activate'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => onDelete(user)}>
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete User</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserActionsMenu;
