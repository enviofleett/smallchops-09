
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CustomerDb } from "@/types/customers";
import { useToast } from "@/hooks/use-toast";
import { createCustomer, updateCustomer } from "@/api/customers";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void; // callback to refresh list after save
  initialCustomer?: CustomerDb | null;
}

// Enhanced validation schema
const customerSchema = z.object({
  name: z.string()
    .min(1, "Customer name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s\'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes"),
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(254, "Email address is too long"),
  phone: z.string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true;
      const digits = val.replace(/[^\d]/g, '');
      return digits.length >= 10;
    }, "Phone number must contain at least 10 digits"),
  sendWelcomeEmail: z.boolean().default(true)
});

type CustomerFormData = z.infer<typeof customerSchema>;

export const CustomerDialog = ({
  open,
  onOpenChange,
  onSave,
  initialCustomer
}: CustomerDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: initialCustomer
      ? { 
          name: initialCustomer.name, 
          email: initialCustomer.email, 
          phone: initialCustomer.phone || "",
          sendWelcomeEmail: true
        }
      : { 
          name: "", 
          email: "", 
          phone: "",
          sendWelcomeEmail: true
        }
  });
  
  const { toast } = useToast();
  const sendWelcomeEmail = watch('sendWelcomeEmail');

  useEffect(() => {
    setValidationErrors([]);
    setSubmitSuccess(false);
    setIsSubmitting(false);
    
    if (initialCustomer) {
      reset({
        name: initialCustomer.name,
        email: initialCustomer.email,
        phone: initialCustomer.phone || "",
        sendWelcomeEmail: true
      });
    } else {
      reset({ 
        name: "", 
        email: "", 
        phone: "",
        sendWelcomeEmail: true
      });
    }
  }, [initialCustomer, reset, open]);

  const onSubmit = async (data: CustomerFormData) => {
    setIsSubmitting(true);
    setValidationErrors([]);
    setSubmitSuccess(false);
    
    try {
      if (initialCustomer) {
        // Update customer (email sending is not applicable for updates)
        await updateCustomer(initialCustomer.id, {
          name: data.name,
          email: data.email,
          phone: data.phone
        });
        
        setSubmitSuccess(true);
        toast({ 
          title: "Customer updated successfully!", 
          description: "Customer information has been saved.",
        });
      } else {
        // Create new customer with optional welcome email
        const result = await createCustomer({
          name: data.name,
          email: data.email,
          phone: data.phone
        }, data.sendWelcomeEmail);
        
        setSubmitSuccess(true);
        toast({ 
          title: "Customer created successfully!", 
          description: result.welcomeEmailQueued 
            ? "Customer has been created and a welcome email has been queued for delivery."
            : "Customer has been created successfully.",
        });
      }
      
      // Close dialog and refresh list after a short delay to show success state
      setTimeout(() => {
        onOpenChange(false);
        onSave();
      }, 1500);
      
    } catch (err: any) {
      console.error('Customer operation error:', err);
      
      // Parse error message for validation errors
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        setValidationErrors(['A customer with this email address already exists.']);
      } else if (err.message.includes('Invalid email')) {
        setValidationErrors(['Please enter a valid email address.']);
      } else if (err.message.includes('Phone number')) {
        setValidationErrors(['Please enter a valid phone number with at least 10 digits.']);
      } else if (err.message.includes('rate limit')) {
        setValidationErrors(['You are performing actions too quickly. Please wait and try again.']);
      } else {
        setValidationErrors([err.message || 'An unexpected error occurred. Please try again.']);
      }
      
      toast({ 
        title: "Error", 
        description: err.message || 'Failed to save customer information.',
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {submitSuccess ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                {initialCustomer ? "Customer Updated" : "Customer Created"}
              </>
            ) : (
              <>
                {initialCustomer ? "Edit Customer" : "Add New Customer"}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Validation Errors Display */}
        {validationErrors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {validationErrors.map((error, index) => (
                  <p key={index} className="text-sm text-destructive">{error}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Customer Name *</Label>
            <Input 
              id="name"
              {...register("name")} 
              disabled={isSubmitting || submitSuccess}
              placeholder="Enter customer's full name"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-destructive text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address *</Label>
            <Input 
              id="email"
              type="email"
              {...register("email")} 
              disabled={isSubmitting || submitSuccess}
              placeholder="customer@example.com"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-destructive text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
            <Input 
              id="phone"
              type="tel"
              {...register("phone")} 
              disabled={isSubmitting || submitSuccess}
              placeholder="+1 (555) 123-4567"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && (
              <p className="text-destructive text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {errors.phone.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Optional - Include country code for international numbers</p>
          </div>

          {/* Welcome Email Option - Only show for new customers */}
          {!initialCustomer && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center space-x-2">
                <Switch
                  id="sendWelcomeEmail"
                  {...register("sendWelcomeEmail")}
                  disabled={isSubmitting || submitSuccess}
                />
                <Label htmlFor="sendWelcomeEmail" className="text-sm font-medium">
                  Send welcome email
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {sendWelcomeEmail 
                  ? "A welcome email will be automatically sent to the customer after account creation."
                  : "No welcome email will be sent. You can manually send one later if needed."
                }
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button 
                type="button" 
                variant="outline" 
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DialogClose>
            
            <Button 
              type="submit" 
              disabled={isSubmitting || submitSuccess}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {initialCustomer ? "Updating..." : "Creating..."}
                </>
              ) : submitSuccess ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Done
                </>
              ) : (
                initialCustomer ? "Save Changes" : "Create Customer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

