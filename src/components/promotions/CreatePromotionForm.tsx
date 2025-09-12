import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Percent, DollarSign, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreatePromotion } from "@/hooks/usePromotions";
import { toast } from "@/hooks/use-toast";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

// Simplified schema focusing on core promotion types
const PromotionFormSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .transform(val => val.trim()),
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .transform(val => val?.trim()),
  type: z.enum([
    "percentage",
    "fixed_amount", 
    "free_delivery",
  ]),
  value: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, "Value must be positive").optional()
  ),
  min_order_amount: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    },
    z.number().min(0, "Minimum order amount must be positive")
  ),
  code: z.string()
    .optional()
    .transform(val => val?.trim().toUpperCase())
    .refine(val => !val || /^[A-Z0-9]{3,20}$/.test(val), "Code must be 3-20 characters, letters and numbers only"),
  valid_from: z.date(),
  valid_until: z.date().optional(),
}).refine((data) => {
  // Value is required for percentage and fixed_amount
  if ((data.type === "percentage" || data.type === "fixed_amount") && !data.value) {
    return false;
  }
  // Percentage must be between 1 and 100
  if (data.type === "percentage" && data.value && (data.value <= 0 || data.value > 100)) {
    return false;
  }
  // Fixed amount must be positive
  if (data.type === "fixed_amount" && data.value && data.value <= 0) {
    return false;
  }
  return true;
}, {
  message: "Invalid value for selected promotion type",
  path: ["value"]
}).refine((data) => {
  // End date must be after start date
  if (data.valid_until && data.valid_until <= data.valid_from) {
    return false;
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["valid_until"]
});

type PromotionFormData = z.infer<typeof PromotionFormSchema>;

export default function CreatePromotionForm({
  onSuccess,
  disabled,
}: {
  onSuccess?: () => void;
  disabled?: boolean;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const createMutation = useCreatePromotion();
  const form = useForm<PromotionFormData>({
    resolver: zodResolver(PromotionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "percentage",
      value: undefined,
      min_order_amount: 0,
      code: "",
      valid_from: new Date(),
      valid_until: undefined,
    },
    mode: "onChange",
  });

  const watchType = form.watch("type");
  const watchValidFrom = form.watch("valid_from");

  const handleSubmit = React.useCallback(async (values: PromotionFormData) => {
    if (isSubmitting || disabled) return;
    
    setIsSubmitting(true);
    
    try {
      // Clean and prepare data
      const cleanedData = {
        name: values.name,
        description: values.description || null,
        type: values.type,
        // Set value to null for free_delivery type
        value: values.type === 'free_delivery' ? null : values.value,
        min_order_amount: values.min_order_amount || 0,
        code: values.code || null,
        // Convert dates to ISO strings
        valid_from: values.valid_from.toISOString(),
        valid_until: values.valid_until?.toISOString() || null,
        // Set status as active by default
        status: 'active' as const,
      };

      await createMutation.mutateAsync(cleanedData);
      
      toast({
        title: "Success",
        description: "Promotion created successfully!",
      });
      
      form.reset();
      onSuccess?.();

    } catch (error: any) {
      console.error('Promotion creation failed:', error);
      
      toast({
        title: "Creation Failed", 
        description: error?.message || "Failed to create promotion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, disabled, form, createMutation, onSuccess]);

  return (
    <ScrollArea className="h-full max-h-[calc(90vh-120px)]">
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between sticky top-0 bg-background pb-2">
          <h3 className="text-lg font-semibold">Create New Promotion</h3>
        </div>

        <Form {...form}>
          <form
            className="space-y-6 pb-20 md:pb-6"
            onSubmit={form.handleSubmit(handleSubmit)}
            autoComplete="off"
            noValidate
          >
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Basic Information
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Summer Sale"
                          {...field}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Type <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={disabled}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select promotion type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">
                            <div className="flex items-center gap-2">
                              <Percent className="w-4 h-4" />
                              Percentage Discount
                            </div>
                          </SelectItem>
                          <SelectItem value="fixed_amount">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Fixed Amount Off
                            </div>
                          </SelectItem>
                          <SelectItem value="free_delivery">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4" />
                              Free Delivery
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe this promotion..."
                        {...field}
                        disabled={disabled}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Promotion Settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Promotion Settings
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Value field - conditionally displayed */}
                {watchType !== "free_delivery" && (
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {watchType === "percentage" && "Discount Percentage"}
                          {watchType === "fixed_amount" && "Discount Amount (₦)"}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              watchType === "percentage" ? "e.g., 20" : "e.g., 2000"
                            }
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={watchType === "percentage" ? 100 : undefined}
                            {...field}
                            value={field.value ?? ""}
                            disabled={disabled}
                          />
                        </FormControl>
                        <FormDescription>
                          {watchType === "percentage" && "Enter 1-100 for percentage discount"}
                          {watchType === "fixed_amount" && "Enter amount in ₦"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Minimum Order Amount */}
                <FormField
                  control={form.control}
                  name="min_order_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Minimum Order Amount (₦)
                        {watchType === "free_delivery" && <span className="text-destructive">*</span>}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 5000"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          {...field}
                          value={field.value ?? ""}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormDescription>
                        {watchType === "free_delivery" 
                          ? "Required minimum order for free delivery" 
                          : "Optional minimum purchase requirement"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Promotion Code */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Promotion Code (Optional)
              </h4>
              
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="e.g., SAVE20 (optional)"
                        {...field}
                        disabled={disabled}
                        className="uppercase"
                      />
                    </FormControl>
                    <FormDescription>
                      Leave empty for automatic discount, or enter a code customers can use
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Validity Period */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Validity Period
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Date */}
                <FormField
                  control={form.control}
                  name="valid_from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Start Date <span className="text-destructive">*</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={disabled}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Select start date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* End Date */}
                <FormField
                  control={form.control}
                  name="valid_until"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={disabled}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "No end date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => {
                              if (date < new Date()) return true;
                              if (watchValidFrom && date < watchValidFrom) return true;
                              return false;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Leave empty for no expiration date
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center gap-3 justify-end pt-4">
              <Button
                type="submit"
                disabled={disabled || isSubmitting || createMutation.isPending}
                className="min-w-[120px]"
              >
                {isSubmitting || createMutation.isPending ? (
                  <>
                    <div className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Promotion
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </ScrollArea>
  );
}