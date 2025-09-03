import React, { useState } from "react";
import { Trophy, PlusCircle, Edit, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePromotions, useDeletePromotion, useUpdatePromotion } from "@/hooks/usePromotions";

import CreatePromotionForm from "@/components/promotions/CreatePromotionForm";
import EditPromotionDialog from "@/components/promotions/EditPromotionDialog";
import type { Promotion, PromotionStatus } from "@/api/promotions";

import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query"; // For the usage counts
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow, MobileCardActions } from '@/components/ui/responsive-table';


// --- Status badge component with semantic tokens ---
function StatusBadge({ status }: { status: string }) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "paused":
      case "inactive":
        return "secondary";
      case "expired":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Badge variant={getStatusVariant(status)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
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


export default function PromotionsPage() {
  const [isDialogOpen, setDialogOpen] = useState(false);

  // Edit promotion dialog state
  const { toast } = useToast();
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

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
          });
          refetchUsage();
        },
        onError: (error) => {
          console.error('Promotion update error:', error);
          toast({
            title: "Failed to update promotion",
            description: "Promotion status change failed.",
            variant: "destructive"
          });
        }
      }
    );
  }


  function onEditPromotion(promo: Promotion) {
    setEditingPromotion(promo);
    setEditDialogOpen(true);
  }

  return (
    <div className="space-y-6 md:space-y-8 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" /> Promotions
          </h1>
          <p className="text-gray-600">Manage your discounts, loyalty and referral promotions here.</p>
        </div>
        <Button size="lg" variant="default" onClick={() => setDialogOpen(true)} className="w-full sm:w-auto min-h-[44px]">
          <PlusCircle className="w-5 h-5" />
          Create Promotion
        </Button>
      </div>

      {/* Promotions Table */}
      {isLoading && <div className="p-8 text-center">Loading...</div>}
      {isError && <div className="p-8 text-center text-red-500">Failed to load promotions.</div>}
      {!isLoading && !isError && (
        <ResponsiveTable
          className="overflow-x-auto rounded-xl border bg-white p-2"
          mobileComponent={
            <div className="space-y-3">
              {data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No promotions found.</div>
              ) : (
                data.map(promo => (
                  <MobileCard key={promo.id}>
                    <MobileCardHeader>
                      <div>
                        <h3 className="font-semibold text-gray-900">{promo.name}</h3>
                        <p className="text-sm text-gray-600 capitalize">{promo.type}</p>
                      </div>
                      <StatusBadge status={promo.status ?? "active"} />
                    </MobileCardHeader>
                    
                    <MobileCardContent>
                      <MobileCardRow 
                        label="Discount" 
                        value={promo.value ? `₦${promo.value}` : "-"} 
                      />
                      <MobileCardRow 
                        label="Min. Purchase" 
                        value={promo.min_order_amount || "-"} 
                      />
                      <MobileCardRow 
                        label="Applicable Days" 
                        value={
                          (!promo.applicable_days || promo.applicable_days.length === 0) ? (
                            <Badge variant="secondary" className="text-xs">All Days</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {promo.applicable_days.slice(0, 4).map((day) => (
                                <Badge key={day} variant="outline" className="text-xs capitalize">
                                  {day.slice(0, 3)}
                                </Badge>
                              ))}
                              {promo.applicable_days.length > 4 && (
                                <span className="text-xs text-muted-foreground">+{promo.applicable_days.length - 4}</span>
                              )}
                            </div>
                          )
                        }
                      />
                      <MobileCardRow 
                        label="Valid From" 
                        value={promo.valid_from ? promo.valid_from.substring(0,10) : "-"} 
                      />
                      <MobileCardRow 
                        label="Expires" 
                        value={promo.valid_until ? promo.valid_until.substring(0,10) : "-"} 
                      />
                      <MobileCardRow 
                        label="Usage" 
                        value={<span className="font-semibold">{usageData[promo.id] ?? 0}</span>} 
                      />
                    </MobileCardContent>
                    
                    <MobileCardActions>
                      <Button size="sm" variant="outline"
                        onClick={() => onEditPromotion(promo)}
                        className="flex items-center gap-2">
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => deleteMutation.mutate(promo.id)}
                        className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50">
                        <Trash className="w-4 h-4" />
                        Delete
                      </Button>
                    </MobileCardActions>
                    
                    {/* Status buttons for mobile */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                      {promo.status !== "active" &&
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusChange(promo, "active")}
                          className="flex-1 min-w-0"
                        >Activate</Button>
                      }
                      {promo.status !== "inactive" &&
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(promo, "inactive")}
                          className="flex-1 min-w-0"
                        >Pause</Button>
                      }
                      {promo.status !== "expired" &&
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(promo, "expired")}
                          className="flex-1 min-w-0"
                        >Expire</Button>
                      }
                    </div>
                  </MobileCard>
                ))
              )}
            </div>
          }
        >
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-sm text-gray-600">
                <th className="p-3">Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Days</th>
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
                  <td className="p-3 capitalize">{promo.type.replace('_', ' ')}</td>
                  <td className="p-3">
                    {promo.type === "percentage" && `${promo.value}%`}
                    {promo.type === "fixed_amount" && `₦${promo.value}`}
                    {promo.type === "buy_one_get_one" && "BOGO"}
                    {promo.type === "free_delivery" && "Free"}
                  </td>
                   <td className="p-3">
                    {(!promo.applicable_days || promo.applicable_days.length === 0) ? (
                      <Badge variant="secondary" className="text-xs">All</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {promo.applicable_days.slice(0, 2).map((day) => (
                          <Badge key={day} variant="outline" className="text-xs capitalize">
                            {day.slice(0, 3)}
                          </Badge>
                        ))}
                        {promo.applicable_days.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{promo.applicable_days.length - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
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
        </ResponsiveTable>
      )}

      {/* Create Promotion Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Create Promotion</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 sm:p-6">
              <CreatePromotionForm
                onSuccess={() => setDialogOpen(false)}
              />
            </div>
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
