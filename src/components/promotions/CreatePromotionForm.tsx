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
  name: z.string().min(2, "Name is required").transform(val => val.trim()),
  description: z.string().max(256).optional().transform(val => val?.trim()),
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
    z.number().min(0).optional()
  ),
  min_order_amount: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0).optional()
  ),
  max_discount_amount: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0).optional()
  ),
  usage_limit: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(1).optional()
  ),
  code: z.string().optional().transform(val => val?.trim().toUpperCase()),
  applicable_categories: z.array(z.string()).optional(),
  applicable_products: z.array(z.string()).optional(),
  applicable_days: z.array(z.string()).optional(),
  valid_from: z.date().optional(),
  valid_until: z.date().optional(),
}).refine((data) => {
  // Business logic validation
  if (data.type === "percentage" && data.value !== undefined) {
    return data.value >= 1 && data.value <= 100;
  }
  if (data.type === "fixed_amount" && data.value !== undefined) {
    return data.value > 0;
  }
  if (data.type === "free_delivery" && data.min_order_amount === undefined) {
    return false;
  }
  return true;
}, {
  message: "Invalid configuration for selected promotion type",
  path: ["value"]
}).refine((data) => {
  // Date range validation
  if (data.valid_from && data.valid_until) {
    return data.valid_until >= data.valid_from;
  }
  return true;
}, {
  message: "End date must be the same or after start date",
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
  const [generateCode, setGenerateCode] = useState(false);
  
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

  // Auto-generate code when enabled
  React.useEffect(() => {
    if (generateCode && !form.getValues('code')) {
      form.setValue('code', generatePromotionCode());
    }
  }, [generateCode, form]);

  // Safe type guard to check for a Date object
  function isDate(val: unknown): val is Date {
    return (
      !!val &&
      typeof val === "object" &&
      Object.prototype.toString.call(val) === "[object Date]"
    );
  }

  function handleSubmit(values: PromotionFormData) {
    const cleaned: Omit<
      import("@/api/promotions").Promotion,
      "status" | "id" | "created_at" | "updated_at"
    > = { ...values } as any;

    // Safely convert dates to ISO string if they are valid Date objects
    if (isDate(cleaned.valid_from)) {
      cleaned.valid_from = cleaned.valid_from.toISOString();
    }
    if (isDate(cleaned.valid_until)) {
      cleaned.valid_until = cleaned.valid_until.toISOString();
    }
    Object.keys(cleaned).forEach(
      key =>
        (cleaned[key] === "" ||
          typeof cleaned[key] === "undefined" ||
          (typeof cleaned[key] === "number" && isNaN(cleaned[key])))
          && delete cleaned[key]
    );
    createMutation.mutate(cleaned, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Promotion created successfully!",
        });
        form.reset();
        onSuccess?.();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error?.message || "Failed to create promotion. Please try again.",
          variant: "destructive",
        });
      },
    });
  }

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
            disabled={disabled || createMutation.isPending}
            className="w-auto"
          >
            {createMutation.isPending ? (
              <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Create Promotion
          </Button>
        </div>

        {/* Mobile Sticky Submit */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg z-50">
          <Button
            type="submit"
            disabled={disabled || createMutation.isPending}
            className="w-full min-h-[44px]"
            size="lg"
          >
            {createMutation.isPending ? (
              <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Create Promotion
          </Button>
        </div>
        </form>
      </Form>
    </div>
  );
}
