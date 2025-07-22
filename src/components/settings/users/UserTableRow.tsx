
import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon } from "lucide-react";
import { User } from './types';
import UserActionsMenu from './UserActionsMenu';

type UserTableRowProps = {
  user: User;
  onEditPermissions: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onDelete: (user: User) => void;
};

const UserTableRow = ({ user, onEditPermissions, onToggleStatus, onDelete }: UserTableRowProps) => {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback>
              <UserIcon className="h-5 w-5 text-gray-400"/>
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">{user.role}</Badge>
      </TableCell>
      <TableCell>
        {user.status === 'active' && <Badge className="bg-green-100 text-green-800 border border-green-200 hover:bg-green-100">Active</Badge>}
        {user.status === 'inactive' && <Badge variant="destructive">Inactive</Badge>}
        {user.status === 'pending' && <Badge variant="secondary">Pending</Badge>}
      </TableCell>
      <TableCell className="text-right">
        <UserActionsMenu 
          user={user}
          onEditPermissions={onEditPermissions}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
};

export default UserTableRow;
