import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryTabDropdownProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const DeliveryTabDropdown = ({ 
  activeTab, 
  onTabChange 
}: DeliveryTabDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'drivers', label: 'Drivers' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'zones', label: 'Delivery Zones' },
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
        className="w-full justify-between h-12 px-4 bg-background border border-input hover:bg-accent hover:text-accent-foreground"
      >
        <span className="font-medium">
          {activeTabData?.label || 'Overview'}
        </span>
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
                  "w-full px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors font-medium",
                  tab.value === activeTab && "bg-accent text-accent-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};