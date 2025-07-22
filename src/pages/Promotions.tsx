import React, { useState } from "react";
import { Trophy, PlusCircle, Edit, Trash, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { usePromotions, useCreatePromotion, useDeletePromotion, useUpdatePromotion } from "@/hooks/usePromotions";
import { useForm } from "react-hook-form";
import CreatePromotionForm from "@/components/promotions/CreatePromotionForm";
import EditPromotionDialog from "@/components/promotions/EditPromotionDialog";
import type { Promotion, PromotionStatus } from "@/api/promotions";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query"; // For the usage counts

// --- Add helper for status colors ---
const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  expired: "bg-gray-200 text-gray-600",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status] || "bg-gray-200 text-gray-600"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// --- Usage fetching helper ---
async function getPromotionUsage(): Promise<Record<string, number>> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase
    .from("promotion_usage")
    .select("promotion_id, id");
  if (error) return {};
  const counts = data.reduce((acc: Record<string, number>, cur: any) => {
    acc[cur.promotion_id] = (acc[cur.promotion_id] || 0) + 1;
    return acc;
  }, {});
  return counts;
}

const tabDefs = [
  { label: "Promotions", value: "promotions" },
];

type PromotionFormData = {
  name: string,
  description?: string,
  type: string,
  discount_percent?: number | "",
  discount_amount?: number | "",
  loyalty_points_reward?: number | "",
  min_purchase?: number | "",
  starts_at?: string,
  expires_at?: string
};

export default function PromotionsPage() {
  const [isDialogOpen, setDialogOpen] = useState(false);

  // Edit promotion dialog state
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);

  const { data = [], isLoading, isError } = usePromotions();
  const deleteMutation = useDeletePromotion();
  const updateMutation = useUpdatePromotion();

  // Fetch promotion usage count
  const { data: usageData = {}, refetch: refetchUsage } = useQuery({
    queryKey: ["promotion-usage-count"],
    queryFn: getPromotionUsage,
  });

  function handleStatusChange(promo: Promotion, newStatus: PromotionStatus) {
    const confirmLabel = newStatus === 'expired'
      ? "Are you sure you want to expire this promotion? This cannot be undone."
      : undefined;

    if (confirmLabel && !window.confirm(confirmLabel)) return;
    updateMutation.mutate(
      { id: promo.id, fields: { status: newStatus } },
      {
        onSuccess: () => {
          toast({
            title: "Promotion updated",
            description: `Promotion status set to "${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}"`,
            variant: "default"
          });
          refetchUsage();
        },
        onError: () => {
          toast({
            title: "Failed to update promotion",
            description: "Promotion status change failed.",
            variant: "destructive"
          });
        }
      }
    );
  }

  // Form for creating a promotion
  const form = useForm<PromotionFormData>({
    defaultValues: {
      name: "",
      description: "",
      type: "discount",
      discount_percent: "",
      discount_amount: "",
      loyalty_points_reward: "",
      min_purchase: "",
      starts_at: "",
      expires_at: "",
    },
  });

  function onSubmit(values: PromotionFormData) {
    // Remove empty fields
    const cleaned: any = Object.fromEntries(
      Object.entries(values).map(([k, v]) =>
        [k, v === "" ? null : v]
      )
    );
  }

  function onEditPromotion(promo: Promotion) {
    setEditingPromotion(promo);
    setEditDialogOpen(true);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-y-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" /> Promotions
          </h1>
          <p className="text-gray-600">Manage your discounts, loyalty and referral promotions here.</p>
        </div>
        <Button size="lg" variant="default" onClick={() => setDialogOpen(true)}>
          <PlusCircle className="w-5 h-5" />
          Create Promotion
        </Button>
      </div>

      <Tabs defaultValue="promotions" className="w-full">
        <TabsList className="mb-4">
          {tabDefs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="promotions">
          {/* Promotions Table */}
          {isLoading && <div className="p-8 text-center">Loading...</div>}
          {isError && <div className="p-8 text-center text-red-500">Failed to load promotions.</div>}
          {!isLoading && !isError && (
            <div className="overflow-x-auto rounded-xl border bg-white p-2">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-sm text-gray-600">
                    <th className="p-3">Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Discount</th>
                    <th className="p-3">Points</th>
                    <th className="p-3">Min. Purchase</th>
                    <th className="p-3">Starts</th>
                    <th className="p-3">Expires</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Usage</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(promo => (
                    <tr key={promo.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{promo.name}</td>
                      <td className="p-3">{promo.type}</td>
                      <td className="p-3">
                        {promo.value ? `₦${promo.value}` : "-"}
                      </td>
                      <td className="p-3">{promo.value || "-"}</td>
                      <td className="p-3">{promo.min_order_amount || "-"}</td>
                      <td className="p-3">{promo.valid_from ? promo.valid_from.substring(0,10) : "-"}</td>
                      <td className="p-3">{promo.valid_until ? promo.valid_until.substring(0,10) : "-"}</td>
                      <td className="p-3">
                        <StatusBadge status={promo.status ?? "active"} />
                      </td>
                      <td className="p-3 text-center">
                        {usageData[promo.id] ?? 0}
                      </td>
                      <td className="p-3 flex flex-col md:flex-row gap-2">
                        <Button size="sm" variant="outline"
                          onClick={() => onEditPromotion(promo)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive"
                          onClick={() => deleteMutation.mutate(promo.id)}>
                          <Trash className="w-4 h-4" />
                        </Button>
                        {/* Status action buttons */}
                        <div className="flex gap-1 mt-1">
                          {promo.status !== "active" &&
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleStatusChange(promo, "active")}
                            >Activate</Button>
                          }
                          {promo.status !== "inactive" &&
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(promo, "inactive")}
                            >Pause</Button>
                          }
                          {promo.status !== "expired" &&
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(promo, "expired")}
                            >Expire</Button>
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 &&
                    <tr><td colSpan={10} className="p-8 text-center text-gray-500">No promotions found.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Promotion Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl w-full p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Create Promotion</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-0">
            <CreatePromotionForm
              onSuccess={() => setDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Promotion Dialog */}
      <EditPromotionDialog
        open={isEditDialogOpen}
        onOpenChange={open => setEditDialogOpen(open)}
        promotion={editingPromotion}
        onSuccess={() => setEditDialogOpen(false)}
      />
    </div>
  );
}
