
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Edit } from "lucide-react";
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

// Define a zod schema similar to create form
const EditPromotionSchema = z.object({
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

type EditPromotionFormData = z.infer<typeof EditPromotionSchema>;

interface EditPromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion: Promotion | null;
  onSuccess?: () => void;
}

const typeList = [
  { value: "discount", label: "Discount" },
  { value: "loyalty", label: "Loyalty" },
  { value: "referral", label: "Referral" },
  { value: "bundle", label: "Bundle" },
  { value: "flash_sale", label: "Flash Sale" },
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
      name: promotion?.name || "",
      description: promotion?.description || "",
      type: (promotion?.type as any) || "discount",
      discount_percent: promotion?.discount_percent || undefined,
      discount_amount: promotion?.discount_amount || undefined,
      loyalty_points_reward: promotion?.loyalty_points_reward || undefined,
      min_purchase: promotion?.min_purchase || undefined,
      starts_at: promotion?.starts_at ? new Date(promotion.starts_at) : undefined,
      expires_at: promotion?.expires_at ? new Date(promotion.expires_at) : undefined,
    },
    values: promotion
      ? {
          name: promotion.name || "",
          description: promotion.description || "",
          type: promotion.type as any,
          discount_percent: promotion.discount_percent || undefined,
          discount_amount: promotion.discount_amount || undefined,
          loyalty_points_reward: promotion.loyalty_points_reward || undefined,
          min_purchase: promotion.min_purchase || undefined,
          starts_at: promotion.starts_at ? new Date(promotion.starts_at) : undefined,
          expires_at: promotion.expires_at ? new Date(promotion.expires_at) : undefined,
        }
      : undefined,
  });

  React.useEffect(() => {
    if (promotion) {
      form.reset({
        name: promotion.name || "",
        description: promotion.description || "",
        type: promotion.type as any,
        discount_percent: promotion.discount_percent || undefined,
        discount_amount: promotion.discount_amount || undefined,
        loyalty_points_reward: promotion.loyalty_points_reward || undefined,
        min_purchase: promotion.min_purchase || undefined,
        starts_at: promotion.starts_at ? new Date(promotion.starts_at) : undefined,
        expires_at: promotion.expires_at ? new Date(promotion.expires_at) : undefined,
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
    // Safely convert dates to ISO if valid
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
                {/* Discount fields */}
                {(watchType === "discount" ||
                  watchType === "flash_sale" ||
                  watchType === "bundle") && (
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
                            >
                              {/* small edit: allow clearing date */}
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
                            >
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
