import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const createAdminSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(['admin', 'manager', 'staff']),
});

type CreateAdminFormData = z.infer<typeof createAdminSchema>;

interface CreateAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateAdminDialog = ({ open, onOpenChange, onSuccess }: CreateAdminDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateAdminFormData>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      email: "",
      role: "admin",
    },
  });

  const onSubmit = async (data: CreateAdminFormData) => {
    setIsSubmitting(true);
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to send invitations");
      }

      // Check for existing invitation
      const { data: existingInvitation } = await supabase
        .from('admin_invitations')
        .select('id, status, expires_at')
        .eq('email', data.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingInvitation) {
        throw new Error("A pending invitation already exists for this email address");
      }

      // Create invitation record - the trigger will automatically send the email
      const { error } = await supabase
        .from('admin_invitations')
        .insert({
          email: data.email,
          role: data.role,
          invited_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Admin invitation sent",
        description: `A secure invitation email has been sent to ${data.email} with setup instructions. The invitation will expire in 7 days.`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Admin invitation error:', error);
      
      // Handle specific errors with user-friendly messages
      let errorMessage = "Failed to send invitation";
      
      if (error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
        errorMessage = "An invitation for this email already exists";
      } else if (error.message?.includes('permission') || error.message?.includes('authorized')) {
        errorMessage = "You don't have permission to create admin invitations";
      } else if (error.message?.includes('rate limit') || error.message?.includes('limit')) {
        errorMessage = "You've reached the invitation limit. Please wait before sending more invitations.";
      } else if (error.message?.includes('logged in')) {
        errorMessage = "You must be logged in to send invitations";
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Admin User</DialogTitle>
          <DialogDescription>
            Send an invitation to create a new admin user. They will receive an email with instructions to set up their account.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="admin@example.com"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};