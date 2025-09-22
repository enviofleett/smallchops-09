import React, { useState } from "react";
import { Trophy, PlusCircle, Edit, Trash, Calendar, Target, BarChart3, Settings, ChevronRight, Percent, DollarSign, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

// --- Status badge component with semantic tokens ---
function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return { variant: "default", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" };
      case "paused":
      case "inactive":
        return { variant: "secondary", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" };
      case "expired":
        return { variant: "outline", className: "bg-red-100 text-red-800 border-red-200 hover:bg-red-100" };
      default:
        return { variant: "outline", className: "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100" };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge variant={config.variant as any} className={config.className}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// --- Promotion Type Icon ---
function PromotionTypeIcon({ type, className = "w-5 h-5" }: { type: string; className?: string }) {
  switch (type) {
    case "percentage":
      return <Percent className={`${className} text-blue-600`} />;
    case "fixed_amount":
      return <DollarSign className={`${className} text-green-600`} />;
    case "free_delivery":
      return <Truck className={`${className} text-purple-600`} />;
    default:
      return <Target className={`${className} text-gray-600`} />;
  }
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

  function onDeletePromotion(promo: Promotion) {
    if (window.confirm(`Are you sure you want to delete "${promo.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(promo.id, {
        onSuccess: () => {
          toast({
            title: "Promotion deleted",
            description: `"${promo.name}" has been successfully deleted.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Failed to delete promotion",
            description: "Please try again later.",
            variant: "destructive"
          });
        }
      });
    }
  }

  // Calculate stats
  const activePromotions = data.filter(p => p.status === 'active').length;
  const totalUsage = Object.values(usageData).reduce((sum, count) => sum + count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="container mx-auto px-3 py-4 sm:px-6 lg:px-8 sm:py-6">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div className="space-y-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500">
                  <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl lg:text-3xl">
                    Promotions
                  </h1>
                  <p className="text-xs text-gray-600 sm:text-sm lg:text-base">
                    Manage your discounts and special offers
                  </p>
                </div>
              </div>
            </div>
            <Button 
              size="lg" 
              onClick={() => setDialogOpen(true)} 
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 h-12 text-base font-medium"
            >
              <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Create Promotion
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-blue-600 truncate">Total</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-900">{data.length}</p>
                  </div>
                  <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-emerald-600 truncate">Active</p>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-900">{activePromotions}</p>
                  </div>
                  <Target className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-purple-600 truncate">Usage</p>
                    <p className="text-lg sm:text-2xl font-bold text-purple-900">{totalUsage}</p>
                  </div>
                  <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-orange-600 truncate">Month</p>
                    <p className="text-lg sm:text-2xl font-bold text-orange-900">{Math.floor(totalUsage * 0.6)}</p>
                  </div>
                  <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Promotions Content */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading promotions...</p>
            </div>
          </div>
        )}

        {isError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <div className="text-red-600">
                <Trophy className="mx-auto h-12 w-12 opacity-50" />
                <p className="mt-4 font-medium">Failed to load promotions</p>
                <p className="text-sm">Please refresh the page or try again later.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && (
          <>
            {data.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Trophy className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No promotions yet</h3>
                  <p className="mt-2 text-gray-600">Get started by creating your first promotion.</p>
                  <Button 
                    className="mt-6" 
                    onClick={() => setDialogOpen(true)}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Create Your First Promotion
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                {data.map((promo) => (
                  <PromotionCard 
                    key={promo.id}
                    promotion={promo}
                    usage={usageData[promo.id] ?? 0}
                    onEdit={() => onEditPromotion(promo)}
                    onDelete={() => onDeletePromotion(promo)}
                    onStatusChange={(status) => handleStatusChange(promo, status)}
                  />
                ))}
              </div>
            )}
          </>
        )}

      {/* Create Promotion Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[85vw] md:max-w-3xl lg:max-w-4xl h-[95vh] sm:h-[90vh] md:h-[85vh] p-0 flex flex-col overflow-hidden border-0 shadow-2xl mx-auto rounded-xl sm:rounded-2xl">
          <DialogHeader className="p-4 sm:p-5 md:p-6 pb-3 sm:pb-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 flex-shrink-0 sticky top-0 z-10 backdrop-blur-sm">
            <DialogTitle className="text-lg sm:text-xl md:text-2xl font-semibold flex items-center gap-2 text-foreground">
              <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Create New Promotion
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
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
    </div>
  );
}

// Promotion Card Component
interface PromotionCardProps {
  promotion: Promotion;
  usage: number;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: PromotionStatus) => void;
}

function PromotionCard({ promotion, usage, onEdit, onDelete, onStatusChange }: PromotionCardProps) {
  const getDiscountDisplay = () => {
    switch (promotion.type) {
      case "percentage":
        return `${promotion.value}% OFF`;
      case "fixed_amount":
        return `₦${promotion.value} OFF`;
      case "free_delivery":
        return "FREE DELIVERY";
      default:
        return "DISCOUNT";
    }
  };

  const getTypeColor = () => {
    switch (promotion.type) {
      case "percentage":
        return "from-blue-500 to-indigo-600";
      case "fixed_amount":
        return "from-green-500 to-emerald-600";
      case "free_delivery":
        return "from-purple-500 to-violet-600";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-0 shadow-md">
      <CardContent className="p-0">
        {/* Header with discount badge */}
        <div className={`bg-gradient-to-r ${getTypeColor()} p-6 text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 transform rotate-12 translate-x-8 -translate-y-8 opacity-10">
            <PromotionTypeIcon type={promotion.type} className="w-full h-full" />
          </div>
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-xl mb-1">{promotion.name}</h3>
                <div className="flex items-center gap-2">
                  <PromotionTypeIcon type={promotion.type} className="w-4 h-4" />
                  <span className="text-sm opacity-90 capitalize">{promotion.type.replace('_', ' ')}</span>
                </div>
              </div>
              <StatusBadge status={promotion.status ?? "active"} />
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold">{getDiscountDisplay()}</div>
              {promotion.min_order_amount > 0 && (
                <div className="text-sm opacity-90 mt-1">
                  Min. order: ₦{promotion.min_order_amount}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 font-medium">Valid From</p>
              <p className="text-gray-900">
                {promotion.valid_from ? format(new Date(promotion.valid_from), 'MMM dd, yyyy') : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 font-medium">Expires</p>
              <p className="text-gray-900">
                {promotion.valid_until ? format(new Date(promotion.valid_until), 'MMM dd, yyyy') : 'No expiry'}
              </p>
            </div>
          </div>

          {/* Usage */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-700">Times Used</span>
            </div>
            <span className="font-bold text-lg text-gray-900">{usage}</span>
          </div>

          {/* Code */}
          {promotion.code && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Promo Code</p>
              <p className="font-mono text-lg font-bold text-blue-900">{promotion.code}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onEdit}
                className="flex-1 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onDelete}
                className="flex-1 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
              >
                <Trash className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>

            {/* Status Actions */}
            <div className="flex gap-1">
              {promotion.status !== "active" && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onStatusChange("active")}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Activate
                </Button>
              )}
              {promotion.status !== "inactive" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusChange("inactive")}
                  className="flex-1"
                >
                  Pause
                </Button>
              )}
              {promotion.status !== "expired" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onStatusChange("expired")}
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Expire
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
