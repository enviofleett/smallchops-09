import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Edit, CalendarIcon } from "lucide-react";
import { DaysSelector } from "./DaysSelector";
import { useUpdatePromotion } from "@/hooks/usePromotions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import type { Promotion } from "@/api/promotions";

const EditPromotionSchema = z.object({
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
  applicable_days: z.array(z.string()).optional(),
  valid_from: z.date().optional(),
  valid_until: z.date().optional(),
});

type EditPromotionFormData = z.infer<typeof EditPromotionSchema>;

interface EditPromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion: Promotion | null;
  onSuccess?: () => void;
}

const typeList = [
  { value: "percentage", label: "Percentage Discount" },
  { value: "fixed_amount", label: "Fixed Amount" },
  { value: "buy_one_get_one", label: "Buy One Get One" },
  { value: "free_delivery", label: "Free Delivery" },
];

export default function EditPromotionDialog({
  open,
  onOpenChange,
  promotion,
  onSuccess,
}: EditPromotionDialogProps) {
  const mutation = useUpdatePromotion();

  const form = useForm<EditPromotionFormData>({
    resolver: zodResolver(EditPromotionSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "percentage",
      value: undefined,
      min_order_amount: undefined,
      max_discount_amount: undefined,
      usage_limit: undefined,
      code: "",
      applicable_days: [],
      valid_from: undefined,
      valid_until: undefined,
    },
  });

  React.useEffect(() => {
    if (promotion) {
      form.reset({
        name: promotion.name || "",
        description: promotion.description || "",
        type: promotion.type as any,
        value: promotion.value || undefined,
        min_order_amount: promotion.min_order_amount || undefined,
        code: promotion.code || "",
        applicable_days: promotion.applicable_days || [],
        valid_from: promotion.valid_from ? new Date(promotion.valid_from) : undefined,
        valid_until: promotion.valid_until ? new Date(promotion.valid_until) : undefined,
      });
    }
  }, [promotion, form]);

  // Safe type guard to check for a Date object
  function isDate(val: unknown): val is Date {
    return (
      !!val &&
      typeof val === "object" &&
      Object.prototype.toString.call(val) === "[object Date]"
    );
  }

  function handleSubmit(values: EditPromotionFormData) {
    if (!promotion) return;
    const cleaned: Partial<Promotion> = { ...values } as any;
    
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
    
    mutation.mutate(
      { id: promotion.id, fields: cleaned },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  }

  const watchType = form.watch("type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>
            <Edit className="inline mr-1" /> Edit Promotion
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-0">
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
                        <Input placeholder="Eg: Summer Discount" {...field} />
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
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {typeList.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
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
                        <Input placeholder="Promotion description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Conditional fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Value field for all types */}
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchType === "percentage" && "Discount Percentage (1-100)"}
                        {watchType === "fixed_amount" && "Discount Amount (₦)"}
                        {watchType === "buy_one_get_one" && "Free Item Discount % (0-100)"}
                        {watchType === "free_delivery" && "Value"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter value"
                          type="number"
                          min={0}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Min Purchase */}
                <FormField
                  control={form.control}
                  name="min_order_amount"
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Promotion Code */}
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promotion Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Optional promo code (e.g., SAVE20)"
                        {...field}
                        className="uppercase"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        disabled={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                              {field.value
                                ? format(field.value, "PPP")
                                : <span>Pick a date</span>}
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
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                              {field.value
                                ? format(field.value, "PPP")
                                : <span>Pick a date</span>}
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

              <DialogFooter className="pt-2 flex flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full md:w-auto"
                >
                  {mutation.isPending ? (
                    <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Edit className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}