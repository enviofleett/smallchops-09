import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderTabDropdownProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  orderCounts: {
    all: number;
    pending: number;
    confirmed: number;
    preparing: number;
    ready: number;
    out_for_delivery: number;
    delivered: number;
  };
}

export const OrderTabDropdown = ({ 
  activeTab, 
  onTabChange, 
  orderCounts 
}: OrderTabDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const tabs = [
    { value: 'all', label: 'All Orders', count: orderCounts.all, color: '' },
    { value: 'pending', label: 'Pending', count: orderCounts.pending, color: '' },
    { value: 'confirmed', label: 'Confirmed', count: orderCounts.confirmed, color: '' },
    { value: 'preparing', label: 'Preparing', count: orderCounts.preparing, color: '' },
    { value: 'ready', label: 'Ready', count: orderCounts.ready, color: '' },
    { value: 'out_for_delivery', label: 'Out for Delivery', count: orderCounts.out_for_delivery, color: '' },
    { value: 'delivered', label: 'Delivered', count: orderCounts.delivered, color: '' },
  ];

  const activeTabData = tabs.find(tab => tab.value === activeTab);

  const handleTabSelect = (tabValue: string) => {
    onTabChange(tabValue);
    setIsOpen(false);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative w-full" data-dropdown-container>
      {/* Dropdown Button */}
      <Button
        variant="outline"
        onClick={handleToggle}
        className={cn(
          "w-full justify-between h-12 px-4 bg-background border border-input hover:bg-accent hover:text-accent-foreground",
          activeTabData?.color
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {activeTabData?.label || 'All Orders'}
          </span>
          <Badge variant="secondary" className="text-xs">
            {activeTabData?.count || 0}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-background border border-input rounded-lg shadow-lg overflow-hidden">
          <div className="py-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabSelect(tab.value)}
                className={cn(
                  "w-full px-4 py-3 text-left flex items-center justify-between hover:bg-accent hover:text-accent-foreground transition-colors",
                  tab.value === activeTab && "bg-accent text-accent-foreground",
                  tab.color
                )}
              >
                <span className="font-medium">
                  {tab.label}
                </span>
                <Badge 
                  variant={tab.value === activeTab ? "default" : "secondary"} 
                  className="text-xs"
                >
                  {tab.count}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};