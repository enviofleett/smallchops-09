
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { User } from './types';
import UserTableRow from './UserTableRow';

type UsersTableProps = {
  users: User[];
  loading: boolean;
  onEditPermissions: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onDelete: (user: User) => void;
};

const UsersTable = ({ users, loading, onEditPermissions, onToggleStatus, onDelete }: UsersTableProps) => {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center p-4">Loading...</TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center p-4">No users found.</TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  onEditPermissions={onEditPermissions}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default UsersTable;
