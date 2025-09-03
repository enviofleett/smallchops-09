import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface MobileTabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  tabs: TabItem[];
  className?: string;
}

export const MobileTabs: React.FC<MobileTabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  tabs,
  className
}) => {
  const isMobile = useIsMobile();
  const [currentTab, setCurrentTab] = React.useState(value || defaultValue || tabs[0]?.value);

  React.useEffect(() => {
    if (value !== undefined) {
      setCurrentTab(value);
    }
  }, [value]);

  const handleValueChange = (newValue: string) => {
    setCurrentTab(newValue);
    onValueChange?.(newValue);
  };

  const currentTabLabel = tabs.find(tab => tab.value === currentTab)?.label || tabs[0]?.label;

  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between bg-background"
            >
              {currentTabLabel}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full min-w-[200px] bg-background border shadow-lg z-50">
            {tabs.map((tab) => (
              <DropdownMenuItem
                key={tab.value}
                onClick={() => handleValueChange(tab.value)}
                className={cn(
                  "cursor-pointer",
                  currentTab === tab.value && "bg-muted"
                )}
              >
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div>
          {tabs.find(tab => tab.value === currentTab)?.content}
        </div>
      </div>
    );
  }

  return (
    <Tabs 
      value={currentTab} 
      onValueChange={handleValueChange}
      className={className}
    >
      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <TabsList className="grid w-full min-w-fit h-auto p-1" style={{
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`
        }}>
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value} 
              className="text-sm px-4 py-2 data-[state=active]:bg-background whitespace-nowrap"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
};