import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Percent, DollarSign, Gift, Truck, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreatePromotion } from "@/hooks/usePromotions";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
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
  name: z.string().min(2, "Name is required"),
  description: z.string().max(256).optional(),
  type: z.enum([
    "percentage",
    "fixed_amount", 
    "buy_one_get_one",
    "free_delivery",
  ]),
  value: z
    .union([z.number().min(0), z.nan()])
    .optional()
    .transform(val => isNaN(val as any) ? undefined : val),
  min_order_amount: z
    .union([z.number().min(0), z.nan()])
    .optional()
    .transform(val => isNaN(val as any) ? undefined : val),
  max_discount_amount: z
    .union([z.number().min(0), z.nan()])
    .optional()
    .transform(val => isNaN(val as any) ? undefined : val),
  usage_limit: z
    .union([z.number().min(1), z.nan()])
    .optional()
    .transform(val => isNaN(val as any) ? undefined : val),
  code: z.string().optional(),
  applicable_categories: z.array(z.string()).optional(),
  applicable_products: z.array(z.string()).optional(),
  applicable_days: z.array(z.string()).optional(),
  valid_from: z.date().optional(),
  valid_until: z.date().optional(),
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
        form.reset();
        onSuccess?.();
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Create New Promotion</h3>
      </div>

      <Form {...form}>
        <form
          className="space-y-4 md:space-y-6"
          onSubmit={form.handleSubmit(handleSubmit)}
          autoComplete="off"
          noValidate
        >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Name
                  <span className="text-red-500">*</span>
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

        {/* Value and Configuration Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {/* Value field - different labels based on type */}
          {watchType !== "free_delivery" && (
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {watchType === "percentage" && "Discount Percentage (1-100)"}
                    {watchType === "fixed_amount" && "Discount Amount (₦)"}
                    {watchType === "buy_one_get_one" && "Free Item Discount % (0-100)"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        watchType === "percentage" ? "e.g., 20" :
                        watchType === "fixed_amount" ? "e.g., 500" :
                        "e.g., 100 (completely free)"
                      }
                      type="number"
                      min={0}
                      max={watchType === "percentage" ? 100 : undefined}
                      {...field}
                      value={field.value ?? ""}
                      disabled={disabled}
                    />
                  </FormControl>
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
                  Minimum Order Amount (₦)
                  {watchType === "free_delivery" && " *"}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={
                      watchType === "free_delivery" ? "e.g., 3000" : "Optional, e.g., 1000"
                    }
                    type="number"
                    min={0}
                    {...field}
                    value={field.value ?? ""}
                    disabled={disabled}
                  />
                </FormControl>
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
                  <FormLabel>Maximum Discount Cap (₦)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional, e.g., 2000"
                      type="number"
                      min={0}
                      {...field}
                      value={field.value ?? ""}
                      disabled={disabled}
                    />
                  </FormControl>
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
                    min={1}
                    {...field}
                    value={field.value ?? ""}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Promotion Code Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <FormLabel>Promotion Code</FormLabel>
            <div className="flex items-center gap-2">
              <Shuffle className="w-4 h-4" />
              <span className="text-sm">Auto-generate</span>
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

        {/* Days Selection */}
        <FormField
          control={form.control}
          name="applicable_days"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <DaysSelector
                  selectedDays={field.value || []}
                  onDaysChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
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

        <div className="flex items-center gap-3 justify-end">
          <Button
            type="submit"
            disabled={disabled || createMutation.isPending}
            className="w-full md:w-auto"
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
