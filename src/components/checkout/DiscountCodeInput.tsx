import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Tag, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DiscountCodeInputProps {
  orderAmount: number;
  customerEmail: string;
  appliedDiscount?: {
    code: string;
    discount_amount: number;
    final_amount: number;
    code_details: {
      name: string;
      description?: string;
    };
  };
  onDiscountApplied: (discount: any) => void;
  onDiscountRemoved: () => void;
}

export function DiscountCodeInput({ 
  orderAmount, 
  customerEmail, 
  appliedDiscount,
  onDiscountApplied, 
  onDiscountRemoved 
}: DiscountCodeInputProps) {
  const [code, setCode] = useState("");
  const { toast } = useToast();

  const validateMutation = useMutation({
    mutationFn: async (discountCode: string) => {
      const { data, error } = await supabase.functions.invoke('validate-discount-code', {
        body: {
          code: discountCode,
          customer_email: customerEmail,
          order_amount: orderAmount,
        }
      });

      if (error) throw error;
      if (!data.valid) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      onDiscountApplied({
        code: code.toUpperCase(),
        ...data
      });
      setCode("");
      toast({
        title: "Discount Applied!",
        description: `You saved ₦${data.discount_amount.toLocaleString()}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Invalid Discount Code",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleApply = () => {
    if (!code.trim()) {
      toast({
        title: "Enter Discount Code",
        description: "Please enter a discount code to apply",
        variant: "destructive",
      });
      return;
    }

    validateMutation.mutate(code.trim().toUpperCase());
  };

  const handleRemove = () => {
    onDiscountRemoved();
    toast({
      title: "Discount Removed",
      description: "Discount code has been removed from your order",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  if (appliedDiscount) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium text-green-900">
                  {appliedDiscount.code_details.name}
                </div>
                <div className="text-sm text-green-700">
                  Code: {appliedDiscount.code} • You saved ₦{appliedDiscount.discount_amount.toLocaleString()}
                </div>
                {appliedDiscount.code_details.description && (
                  <div className="text-xs text-green-600 mt-1">
                    {appliedDiscount.code_details.description}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-green-700 hover:text-green-900 hover:bg-green-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Have a discount code?</span>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Enter discount code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              disabled={validateMutation.isPending}
              className="uppercase"
            />
            <Button
              onClick={handleApply}
              disabled={validateMutation.isPending || !code.trim()}
              className="shrink-0"
            >
              {validateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Apply"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}