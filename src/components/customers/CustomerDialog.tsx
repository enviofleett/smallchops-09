
import React, { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { CustomerDb } from "@/types/customers";
import { useToast } from "@/hooks/use-toast";
import { createCustomer, updateCustomer } from "@/api/customers";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void; // callback to refresh list after save
  initialCustomer?: CustomerDb | null;
}

type CustomerFormData = {
  name: string;
  email: string;
  phone?: string;
};

export const CustomerDialog = ({
  open,
  onOpenChange,
  onSave,
  initialCustomer
}: CustomerDialogProps) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerFormData>({
    defaultValues: initialCustomer
      ? { name: initialCustomer.name, email: initialCustomer.email, phone: initialCustomer.phone || "" }
      : { name: "", email: "", phone: "" }
  });
  const { toast } = useToast();

  useEffect(() => {
    if (initialCustomer) {
      reset({
        name: initialCustomer.name,
        email: initialCustomer.email,
        phone: initialCustomer.phone || ""
      });
    } else {
      reset({ name: "", email: "", phone: "" });
    }
  }, [initialCustomer, reset]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (initialCustomer) {
        await updateCustomer(initialCustomer.id, data);
        toast({ title: "Customer updated!" });
      } else {
        await createCustomer(data);
        toast({ title: "Customer created!" });
      }
      onOpenChange(false);
      onSave();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block mb-1 font-medium">Name</label>
            <Input {...register("name", { required: "Name is required" })} />
            {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block mb-1 font-medium">Email</label>
            <Input {...register("email", { required: "Email is required" })} type="email" />
            {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block mb-1 font-medium">Phone</label>
            <Input {...register("phone")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>{initialCustomer ? "Save Changes" : "Add Customer"}</Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

