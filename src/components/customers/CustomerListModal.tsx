
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Phone } from "lucide-react";
import { Customer } from "@/types/customers";
import { CustomerDetailsModal } from "./CustomerDetailsModal";

interface CustomerListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  customers: Customer[];
}

export const CustomerListModal = ({ open, onOpenChange, title, customers }: CustomerListModalProps) => {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  const handleShowDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailsOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title} ({customers.length})</DialogTitle>
          </DialogHeader>
          <input
            className="w-full mb-3 px-3 py-2 rounded-md border border-gray-200 focus:ring-2 focus:ring-blue-500"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="divide-y">
            {filtered.length === 0 && (
              <div className="text-gray-500 text-center py-8">No customers found.</div>
            )}
            {filtered.map((c, i) => (
              <div
                className="flex items-center py-3 gap-3 group cursor-pointer hover:bg-gray-50 transition rounded-lg"
                key={c.id}
                onClick={() => handleShowDetails(c)}
                tabIndex={0}
                role="button"
                aria-label={`Show details for ${c.name}`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate group-hover:underline">
                    {i + 1}. {c.name}
                  </div>
                  <div className="flex flex-col gap-0.5 mt-0.5 text-gray-600 text-xs">
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 mr-1 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </span>
                    {c.phone && (
                      <span className="flex items-center gap-1 truncate">
                        <Phone className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate">{c.phone}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs whitespace-nowrap">
                  <div>
                    <span className="font-semibold">{c.totalOrders}</span> orders
                  </div>
                  <div>
                    ₦{c.totalSpent.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <CustomerDetailsModal
        open={detailsOpen}
        onOpenChange={open => {
          setDetailsOpen(open);
          if (!open) setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
      />
    </>
  );
};
