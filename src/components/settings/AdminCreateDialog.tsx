
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MenuSection,
  PermissionLevel,
  getInitialPermissions,
} from "./users/types";
import UserDetailsForm from "./users/UserDetailsForm";
import PermissionsForm from "./users/PermissionsForm";

const AdminCreateDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) => {
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [permissions, setPermissions] = useState<
    Record<MenuSection, PermissionLevel>
  >(getInitialPermissions());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setForm({ email: "", password: "", name: "" });
      setPermissions(getInitialPermissions());
      setActiveTab("details");
    }
    onOpenChange(isOpen);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePermissionChange = (
    section: MenuSection,
    level: PermissionLevel
  ) => {
    setPermissions((prev) => ({ ...prev, [section]: level }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.password || !form.name) {
      toast({
        title: "Name, email, and password are required",
        variant: "destructive",
      });
      setActiveTab("details");
      return;
    }

    setLoading(true);

    const permissionsToSave = Object.entries(permissions)
      .filter(([, level]) => level !== "none")
      .map(([section, level]) => ({
        menu_section: section as MenuSection,
        permission_level: level as "view" | "edit",
      }));

    try {
      const { data, error } = await supabase.functions.invoke(
        "user-management",
        {
          method: 'POST',
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            name: form.name,
            role: "admin",
            permissions: permissionsToSave,
          }),
        }
      );

      if (error || data?.error) {
        toast({
          title: "Error creating user",
          description:
            error?.message || data?.error?.message || "Unable to create admin user.",
          variant: "destructive",
        });
      } else if (data?.user) {
        toast({ title: "Admin user created successfully" });
        onSuccess();
        handleOpenChange(false);
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err.message || String(err),
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Admin User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="mt-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">User Details</TabsTrigger>
              <TabsTrigger value="permissions">Menu Permissions</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <UserDetailsForm
                form={form}
                handleChange={handleChange}
                loading={loading}
              />
            </TabsContent>
            <TabsContent value="permissions">
              <PermissionsForm
                permissions={permissions}
                handlePermissionChange={handlePermissionChange}
                loading={loading}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-auto">
              {loading
                ? "Creating..."
                : "Create Admin & Set Permissions"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminCreateDialog;
