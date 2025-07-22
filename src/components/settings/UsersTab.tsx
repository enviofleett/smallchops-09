
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminCreateDialog from "./AdminCreateDialog";
import PermissionsDialog from "./PermissionsDialog";
import UsersTable from "./users/UsersTable";
import DeleteUserDialog from "./users/DeleteUserDialog";
import type { User } from "./users/types";

const UsersTab = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("user-management", {
          method: 'GET'
        });
        if (error || data?.error) {
          toast({
            title: "Error loading users",
            description: error?.message || data?.error || "An error occurred.",
            variant: "destructive",
          });
          setUsers([]);
        } else if (data?.data) {
          setUsers(data.data.sort((a: User, b: User) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        }
      } catch (e: any) {
        toast({
          title: "Network Error",
          description: e.message || String(e),
          variant: "destructive",
        });
      }
      setLoading(false);
    };
    fetchUsers();
  }, [refresh, toast]);

  const handleUserCreated = () => {
    setRefresh((r) => !r);
    setCreateDialogOpen(false);
  };
  
  const handleOpenPermissionsDialog = (user: User) => {
    setUserToEdit(user);
    setPermissionsDialogOpen(true);
  };

  const handleOpenDeleteDialog = (user: User) => {
    setUserToDelete(user);
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const { data, error } = await supabase.functions.invoke("user-management", {
        method: 'PUT',
        body: { userId: user.id, status: newStatus },
      });

      if (error || data?.error) throw new Error(error?.message || data?.error?.message);
      
      toast({ title: `User status updated to ${newStatus}` });
      setRefresh(r => !r);
    } catch (error: any) {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const { data, error } = await supabase.functions.invoke("user-management", {
        method: 'DELETE',
        body: { userId: userToDelete.id },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error?.message);
      toast({ title: "User deleted successfully" });
      setRefresh(r => !r);
    } catch (error: any) {
      toast({ title: "Error deleting user", description: error.message, variant: "destructive" });
    } finally {
      setUserToDelete(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Manage Users & Admins</h2>
        <Button onClick={() => setCreateDialogOpen(true)} className="font-medium" disabled={loading}>
          Create New Admin
        </Button>
      </div>
      <AdminCreateDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
        onSuccess={handleUserCreated} 
      />
      
      <UsersTable
        users={users}
        loading={loading}
        onEditPermissions={handleOpenPermissionsDialog}
        onToggleStatus={handleToggleStatus}
        onDelete={handleOpenDeleteDialog}
      />
      
      <DeleteUserDialog
        user={userToDelete}
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        onConfirm={handleDeleteUser}
      />
      
      <PermissionsDialog
        user={userToEdit}
        open={permissionsDialogOpen}
        onOpenChange={setPermissionsDialogOpen}
        onSuccess={() => {
          setPermissionsDialogOpen(false);
          setRefresh(r => !r);
        }}
      />
    </div>
  );
};

export default UsersTab;
