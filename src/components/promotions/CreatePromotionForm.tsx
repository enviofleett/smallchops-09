import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Percent, DollarSign, Gift, Truck, Shuffle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DaysSelector } from "./DaysSelector";

const PromotionFormSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .transform(val => val.trim())
    .refine(val => val.length > 0, "Name is required"),
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .transform(val => val?.trim()),
  type: z.enum([
    "percentage",
    "fixed_amount", 
    "buy_one_get_one",
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
      if (val === "" || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, "Minimum order amount must be positive").optional()
  ),
  max_discount_amount: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, "Maximum discount amount must be positive").optional()
  ),
  usage_limit: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(1, "Usage limit must be at least 1").max(1000000, "Usage limit too high").optional()
  ),
  code: z.string()
    .optional()
    .transform(val => val?.trim().toUpperCase())
    .refine(val => !val || /^[A-Z0-9]{3,20}$/.test(val), "Code must be 3-20 characters, letters and numbers only"),
  applicable_categories: z.array(z.string()).optional(),
  applicable_products: z.array(z.string()).optional(),
  applicable_days: z.array(z.string()).optional(),
  valid_from: z.date().optional(),
  valid_until: z.date().optional(),
}).refine((data) => {
  // PRODUCTION: Enhanced business logic validation
  if (data.type === "percentage" && data.value !== undefined) {
    return data.value >= 1 && data.value <= 100;
  }
  if (data.type === "fixed_amount" && data.value !== undefined) {
    return data.value > 0 && data.value <= 1000000;
  }
  if (data.type === "buy_one_get_one" && data.value !== undefined) {
    return data.value >= 0 && data.value <= 100;
  }
  if (data.type === "free_delivery" && data.min_order_amount === undefined) {
    return false;
  }
  return true;
}, {
  message: "Invalid configuration for selected promotion type",
  path: ["value"]
}).refine((data) => {
  // PRODUCTION: Enhanced date range validation
  if (data.valid_from && data.valid_until) {
    const daysDifference = Math.ceil((data.valid_until.getTime() - data.valid_from.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference < 0) return false;
    if (daysDifference > 365) return false; // Max 1 year promotion
    return true;
  }
  return true;
}, {
  message: "End date must be after start date and within 1 year",
  path: ["valid_until"]
}).refine((data) => {
  // PRODUCTION: Max discount validation for percentage
  if (data.type === "percentage" && data.max_discount_amount && data.min_order_amount) {
    return data.max_discount_amount <= data.min_order_amount;
  }
  return true;
}, {
  message: "Maximum discount cannot exceed minimum order amount",
  path: ["max_discount_amount"]
});

type PromotionFormData = z.infer<typeof PromotionFormSchema>;

export default function CreatePromotionForm({
  onSuccess,
  disabled,
}: {
  onSuccess?: () => void;
  disabled?: boolean;
}) {
  const [generateCode, setGenerateCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const createMutation = useCreatePromotion();
  const form = useForm<PromotionFormData>({
    resolver: zodResolver(PromotionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "percentage",
      value: undefined,
      min_order_amount: undefined,
      max_discount_amount: undefined,
      usage_limit: undefined,
      code: "",
      applicable_categories: [],
      applicable_products: [],
      applicable_days: [],
      valid_from: undefined,
      valid_until: undefined,
    },
    mode: "onChange", // PRODUCTION: Real-time validation
  });

  const watchType = form.watch("type");
  const watchValidFrom = form.watch("valid_from");
  
  // Generate random promotion code
  const generatePromotionCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // PRODUCTION: Enhanced auto-generate code with cleanup
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (generateCode && !form.getValues('code')) {
      // Add small delay to prevent rapid regeneration
      timeoutId = setTimeout(() => {
        form.setValue('code', generatePromotionCode());
      }, 100);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [generateCode, form]);

  // PRODUCTION: Cleanup on unmount
  React.useEffect(() => {
    return () => {
      setIsSubmitting(false);
    };
  }, []);

  // Safe type guard to check for a Date object
  function isDate(val: unknown): val is Date {
    return (
      !!val &&
      typeof val === "object" &&
      Object.prototype.toString.call(val) === "[object Date]"
    );
  }

  // PRODUCTION: Enhanced submit handler with comprehensive error handling
  const handleSubmit = React.useCallback(async (values: PromotionFormData) => {
    if (isSubmitting || disabled) return;
    
    setIsSubmitting(true);
    
    try {
      // PRODUCTION: Comprehensive validation
      const validation = PromotionFormSchema.safeParse(values);
      if (!validation.success) {
        console.error('Form validation failed:', validation.error);
        toast({
          title: "Validation Error",
          description: "Please check all required fields and try again.",
          variant: "destructive",
        });
        return;
      }

      // PRODUCTION: Clean and prepare data
      const cleaned: Omit<
        import("@/api/promotions").Promotion,
        "status" | "id" | "created_at" | "updated_at"
      > = { ...validation.data } as any;

      // PRODUCTION: Enhanced date handling with proper validation
      if (isDate(cleaned.valid_from)) {
        // Ensure date is not in the past
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (cleaned.valid_from < now) {
          toast({
            title: "Invalid Date",
            description: "Start date cannot be in the past.",
            variant: "destructive",
          });
          return;
        }
        cleaned.valid_from = cleaned.valid_from.toISOString();
      }

      if (isDate(cleaned.valid_until)) {
        cleaned.valid_until = cleaned.valid_until.toISOString();
      }

      // PRODUCTION: Remove empty values and sanitize
      Object.keys(cleaned).forEach(key => {
        const value = cleaned[key as keyof typeof cleaned];
        if (
          value === "" || 
          value === null || 
          value === undefined ||
          (typeof value === "number" && isNaN(value)) ||
          (Array.isArray(value) && value.length === 0)
        ) {
          delete cleaned[key as keyof typeof cleaned];
        }
      });

      // PRODUCTION: Business logic validation
      if (cleaned.type === 'free_delivery' && !cleaned.min_order_amount) {
        toast({
          title: "Configuration Error",
          description: "Free delivery promotions require a minimum order amount.",
          variant: "destructive",
        });
        return;
      }

      if (cleaned.type !== 'free_delivery' && !cleaned.value) {
        toast({
          title: "Configuration Error",
          description: "Please specify a discount value for this promotion type.",
          variant: "destructive",
        });
        return;
      }

      // PRODUCTION: Attempt to create promotion
      await createMutation.mutateAsync(cleaned);
      
      toast({
        title: "Success",
        description: "Promotion created successfully!",
      });
      
      // PRODUCTION: Safe form reset
      form.reset();
      setGenerateCode(false);
      onSuccess?.();

    } catch (error: any) {
      console.error('Promotion creation failed:', error);
      
      const errorMessage = error?.message || error?.toString() || "Failed to create promotion. Please try again.";
      
      toast({
        title: "Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, disabled, form, createMutation, onSuccess]);

  return (
    <div className="space-y-4 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between sticky top-0 bg-background pb-2">
        <h3 className="text-lg font-semibold">Create New Promotion</h3>
      </div>

      <Form {...form}>
        <form
          className="space-y-4 pb-20 md:pb-6"
          onSubmit={form.handleSubmit(handleSubmit)}
          autoComplete="off"
          noValidate
        >
        {/* Basics Section */}
        <div className="space-y-1">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Basics</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Name
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Eg: Summer Discount"
                    autoFocus
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
                <FormLabel>Promotion Type</FormLabel>
                <Select
                  onValueChange={val => field.onChange(val)}
                  value={field.value}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="percentage">
                      <Percent className="inline-block w-4 h-4 mr-2" />
                      Percentage Discount
                    </SelectItem>
                    <SelectItem value="fixed_amount">
                      <DollarSign className="inline-block w-4 h-4 mr-2" />
                      Fixed Amount
                    </SelectItem>
                    <SelectItem value="buy_one_get_one">
                      <Gift className="inline-block w-4 h-4 mr-2" />
                      Buy One Get One
                    </SelectItem>
                    <SelectItem value="free_delivery">
                      <Truck className="inline-block w-4 h-4 mr-2" />
                      Free Delivery
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="col-span-1 sm:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe how this promotion works and when it applies..."
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

        {/* Configuration Section */}
        <div className="space-y-1">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Configuration</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Value field - different labels based on type */}
          {watchType !== "free_delivery" && (
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {watchType === "percentage" && "Discount Percentage"}
                    {watchType === "fixed_amount" && "Discount Amount"}
                    {watchType === "buy_one_get_one" && "Free Item Discount %"}
                    {(watchType === "percentage" || watchType === "buy_one_get_one") && <span className="text-destructive">*</span>}
                    {watchType === "fixed_amount" && <span className="text-destructive">*</span>}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        watchType === "percentage" ? "e.g., 20" :
                        watchType === "fixed_amount" ? "e.g., 500" :
                        "e.g., 100 (completely free)"
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
                    {watchType === "fixed_amount" && "Enter amount in ₦ (e.g., 500 for ₦500 off)"}
                    {watchType === "buy_one_get_one" && "Enter 0-100 for discount on free item"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Min Purchase */}
          <FormField
            control={form.control}
            name="min_order_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Minimum Order Amount
                  {watchType === "free_delivery" && <span className="text-destructive">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={
                      watchType === "free_delivery" ? "e.g., 3000" : "Optional, e.g., 1000"
                    }
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
                    ? "Required threshold for free delivery" 
                    : "Optional minimum purchase requirement"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Max Discount Amount (for percentage) */}
          {watchType === "percentage" && (
            <FormField
              control={form.control}
              name="max_discount_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Discount Cap</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional, e.g., 2000"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      {...field}
                      value={field.value ?? ""}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional cap on total discount amount in ₦
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Usage Limit */}
          <FormField
            control={form.control}
            name="usage_limit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Usage Limit</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Optional, e.g., 100"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    {...field}
                    value={field.value ?? ""}
                    disabled={disabled}
                  />
                </FormControl>
                <FormDescription>
                  Total number of times this promotion can be used
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Code Section */}
        <div className="space-y-1">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Promotion Code</h4>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Auto-generate code</span>
            <div className="flex items-center gap-2">
              <Shuffle className="w-4 h-4" />
              <Switch checked={generateCode} onCheckedChange={setGenerateCode} />
            </div>
          </div>
          
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Optional promo code (e.g., SAVE20)"
                      {...field}
                      disabled={disabled || generateCode}
                      className="uppercase"
                    />
                    {!generateCode && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.setValue('code', generatePromotionCode())}
                        disabled={disabled}
                      >
                        Generate
                      </Button>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Schedule Section */}
        <div className="space-y-1">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Schedule</h4>
        </div>
        
        {/* Days Selection */}
        <FormField
          control={form.control}
          name="applicable_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Applicable Days</FormLabel>
              <FormControl>
                <DaysSelector
                  selectedDays={field.value || []}
                  onDaysChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>
              <FormDescription>
                Select specific days or leave empty for all days
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Start Date */}
          <FormField
            control={form.control}
            name="valid_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        type="button"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={disabled}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                      className={cn("p-3 pointer-events-auto")}
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
                        type="button"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={disabled}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Desktop Submit */}
        <div className="hidden md:flex items-center gap-3 justify-end">
          <Button
            type="submit"
            disabled={disabled || isSubmitting || createMutation.isPending}
            className="w-auto"
          >
            {isSubmitting || createMutation.isPending ? (
              <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {isSubmitting ? "Creating..." : "Create Promotion"}
          </Button>
        </div>

        {/* Mobile Sticky Submit */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
          <Button
            type="submit"
            disabled={disabled || isSubmitting || createMutation.isPending}
            className="w-full min-h-[44px]"
            size="lg"
          >
            {isSubmitting || createMutation.isPending ? (
              <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {isSubmitting ? "Creating..." : "Create Promotion"}
          </Button>
        </div>
        </form>
      </Form>
    </div>
  );
}
