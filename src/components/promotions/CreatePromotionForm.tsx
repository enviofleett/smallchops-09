import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Percent, Gift } from "lucide-react";
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

const PromotionFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().max(256).optional(),
  type: z.enum([
    "discount",
    "loyalty",
    "referral",
    "bundle",
    "flash_sale",
  ]),
  discount_percent: z
    .union([z.number().min(1).max(100), z.nan()])
    .optional()
    .transform(val => isNaN(val as any) ? undefined : val),
  discount_amount: z
    .union([z.number().min(1), z.nan()])
    .optional()
    .transform(val => isNaN(val as any) ? undefined : val),
  loyalty_points_reward: z
    .union([z.number().min(1), z.nan()])
    .optional()
    .transform(val => isNaN(val as any) ? undefined : val),
  min_purchase: z
    .union([z.number().min(0), z.nan()])
    .optional()
    .transform(val => isNaN(val as any) ? undefined : val),
  starts_at: z.date().optional(),
  expires_at: z.date().optional(),
});

type PromotionFormData = z.infer<typeof PromotionFormSchema>;

export default function CreatePromotionForm({
  onSuccess,
  disabled,
}: {
  onSuccess?: () => void;
  disabled?: boolean;
}) {
  const createMutation = useCreatePromotion();
  const form = useForm<PromotionFormData>({
    resolver: zodResolver(PromotionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "discount",
      discount_percent: undefined,
      discount_amount: undefined,
      loyalty_points_reward: undefined,
      min_purchase: undefined,
      starts_at: undefined,
      expires_at: undefined,
    },
  });

  const watchType = form.watch("type");

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
    if (isDate(cleaned.starts_at)) {
      cleaned.starts_at = cleaned.starts_at.toISOString();
    }
    if (isDate(cleaned.expires_at)) {
      cleaned.expires_at = cleaned.expires_at.toISOString();
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
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(handleSubmit)}
        autoComplete="off"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <SelectItem value="discount">
                      <Percent className="inline-block w-4 h-4 mr-2" />
                      Discount
                    </SelectItem>
                    <SelectItem value="loyalty">
                      <Gift className="inline-block w-4 h-4 mr-2" />
                      Loyalty
                    </SelectItem>
                    <SelectItem value="referral">
                      <Plus className="inline-block w-4 h-4 mr-2" />
                      Referral
                    </SelectItem>
                    <SelectItem value="bundle">Bundle</SelectItem>
                    <SelectItem value="flash_sale">Flash Sale</SelectItem>
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
              <FormItem className="col-span-1 md:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Promotion description..."
                    {...field}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Conditional fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Discount fields (show for discount/flash_sale/bundle) */}
          {(watchType === "discount" || watchType === "flash_sale" || watchType === "bundle") && (
            <>
              <FormField
                control={form.control}
                name="discount_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount %</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="%"
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        value={field.value ?? ""}
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount ₦</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="₦"
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
            </>
          )}

          {/* Loyalty fields */}
          {watchType === "loyalty" && (
            <FormField
              control={form.control}
              name="loyalty_points_reward"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loyalty Points Reward</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Points"
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
          )}

          {/* Min Purchase */}
          <FormField
            control={form.control}
            name="min_purchase"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min. Purchase (₦)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0"
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
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Date */}
          <FormField
            control={form.control}
            name="starts_at"
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
            name="expires_at"
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
  );
}
