import { format } from "date-fns";
import { Edit, Trash2, Copy, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface DiscountCode {
  id: string;
  code: string;
  name: string;
  description: string;
  type: string;
  value: number;
  min_order_amount: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_count: number;
  new_customers_only: boolean;
  valid_from: string;
  valid_until?: string;
  applicable_days: string[];
  is_active: boolean;
  created_at: string;
}

interface DiscountCodesTableProps {
  discountCodes: DiscountCode[];
  isLoading: boolean;
  onEdit: (code: DiscountCode) => void;
  onDelete: (id: string) => void;
}

export function DiscountCodesTable({ discountCodes, isLoading, onEdit, onDelete }: DiscountCodesTableProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Discount code copied to clipboard",
    });
  };

  const getStatusBadge = (code: DiscountCode) => {
    if (!code.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }

    const now = new Date();
    const validFrom = new Date(code.valid_from);
    const validUntil = code.valid_until ? new Date(code.valid_until) : null;

    if (now < validFrom) {
      return <Badge variant="outline">Scheduled</Badge>;
    }

    if (validUntil && now > validUntil) {
      return <Badge variant="destructive">Expired</Badge>;
    }

    if (code.usage_limit && code.usage_count >= code.usage_limit) {
      return <Badge variant="destructive">Limit Reached</Badge>;
    }

    return <Badge variant="default">Active</Badge>;
  };

  const formatDiscountValue = (type: string, value: number) => {
    return type === "percentage" ? `${value}%` : `₦${value.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discount Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discount Codes ({discountCodes.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {discountCodes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No discount codes created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center gap-2">
                        {code.code}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(code.code)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{code.name}</div>
                        {code.description && (
                          <div className="text-sm text-muted-foreground">{code.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {code.type === "percentage" ? "Percentage" : "Fixed Amount"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDiscountValue(code.type, code.value)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{code.usage_count} used</div>
                        {code.usage_limit && (
                          <div className="text-muted-foreground">
                            of {code.usage_limit} limit
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>From: {format(new Date(code.valid_from), "MMM dd, yyyy")}</div>
                        {code.valid_until ? (
                          <div className="text-muted-foreground">
                            Until: {format(new Date(code.valid_until), "MMM dd, yyyy")}
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No expiry</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(code)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(code)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(code.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}