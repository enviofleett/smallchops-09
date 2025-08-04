import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Truck, ChevronDown, Check, Search } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getDeliveryZonesWithFees, DeliveryZoneWithFee } from '@/api/delivery';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DeliveryZoneDropdownProps {
  selectedZoneId?: string;
  onZoneSelect: (zoneId: string, deliveryFee: number) => void;
  orderSubtotal: number;
}

export const DeliveryZoneDropdown: React.FC<DeliveryZoneDropdownProps> = ({
  selectedZoneId,
  onZoneSelect,
  orderSubtotal
}) => {
  const [zones, setZones] = useState<DeliveryZoneWithFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const data = await getDeliveryZonesWithFees();
      setZones(data);
    } catch (error) {
      console.error('Error fetching zones:', error);
      toast.error('Failed to load delivery zones');
    } finally {
      setLoading(false);
    }
  };

  const calculateDeliveryFee = (zone: DeliveryZoneWithFee): number => {
    if (!zone.delivery_fees) return 0;
    
    const { base_fee, min_order_for_free_delivery } = zone.delivery_fees;
    
    // Check if order qualifies for free delivery
    if (min_order_for_free_delivery && orderSubtotal >= min_order_for_free_delivery) {
      return 0;
    }
    
    return base_fee;
  };

  const handleZoneSelect = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    
    const deliveryFee = calculateDeliveryFee(zone);
    onZoneSelect(zoneId, deliveryFee);
  };

  const selectedZone = zones.find(z => z.id === selectedZoneId);
  const selectedDeliveryFee = selectedZone ? calculateDeliveryFee(selectedZone) : 0;
  const selectedIsFree = selectedDeliveryFee === 0 && selectedZone?.delivery_fees?.min_order_for_free_delivery;

  if (loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center">
          <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
          Select Delivery Zone *
        </h3>
        <div className="h-10 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center">
          <Truck className="h-4 w-4 mr-2 text-red-500" />
          Delivery Not Available
        </h3>
        <p className="text-sm text-muted-foreground">
          No delivery zones are currently configured. Please contact support.
        </p>
      </div>
    );
  }


  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center">
        <Truck className="h-4 w-4 mr-2 text-primary" />
        Select Delivery Zone *
      </h3>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full h-auto min-h-[44px] justify-between bg-background border-border hover:border-primary/50 transition-colors"
          >
            {selectedZone ? (
              <div className="flex items-center justify-between w-full py-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedZone.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDeliveryFee === 0 ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                      {selectedIsFree ? 'FREE' : 'No Charge'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-primary border-primary/30">
                      ₦{selectedDeliveryFee.toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>Search and select delivery zone...</span>
              </div>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-full p-0 z-[100]" align="start">
          <Command>
            <CommandInput placeholder="Search delivery zones..." className="h-9" />
            <CommandEmpty>No delivery zone found.</CommandEmpty>
            <CommandGroup>
              <CommandList className="max-h-[200px] overflow-y-auto">
                {zones.map((zone) => {
                  const deliveryFee = calculateDeliveryFee(zone);
                  const isFreeDelivery = deliveryFee === 0 && zone.delivery_fees?.min_order_for_free_delivery;
                  const isSelected = selectedZoneId === zone.id;
                  
                  return (
                    <CommandItem
                      key={zone.id}
                      value={zone.name + " " + (zone.description || "")}
                      onSelect={() => {
                        handleZoneSelect(zone.id);
                        setOpen(false);
                      }}
                      className="cursor-pointer p-3 border-b last:border-b-0"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="font-medium">{zone.name}</span>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          
                          {zone.description && (
                            <p className="text-sm text-muted-foreground">
                              {zone.description}
                            </p>
                          )}
                          
                          {zone.delivery_fees?.min_order_for_free_delivery && (
                            <p className="text-xs text-muted-foreground">
                              Free delivery on orders above ₦{zone.delivery_fees.min_order_for_free_delivery.toFixed(2)}
                            </p>
                          )}
                        </div>
                        
                        <div className="ml-3">
                          {deliveryFee === 0 ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                              {isFreeDelivery ? 'FREE' : 'No Charge'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-primary border-primary/30">
                              ₦{deliveryFee.toFixed(2)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedZone?.delivery_fees?.min_order_for_free_delivery && orderSubtotal < selectedZone.delivery_fees.min_order_for_free_delivery && (
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
          💡 Tip: Add ₦{(selectedZone.delivery_fees.min_order_for_free_delivery - orderSubtotal).toFixed(2)} more to qualify for free delivery!
        </div>
      )}
    </div>
  );
};