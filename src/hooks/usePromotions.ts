
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  Promotion,
} from "@/api/promotions";

export function usePromotions() {
  return useQuery({
    queryKey: ["promotions"],
    queryFn: getPromotions,
  });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPromotion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<Promotion> }) =>
      updatePromotion(id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });
}

export function useDeletePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promotions"] }),
  });
}
