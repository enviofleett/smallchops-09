import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Phone, Car, MapPin } from 'lucide-react';

interface EnhancedDriverSectionProps {
  order: any;
  assignedAgent?: any;
  drivers?: any[];
  isAdmin?: boolean;
  onAssignDriver?: (driverId: string) => void;
  assigningDriver?: boolean;
}

/**
 * Enhanced driver section with avatar, contact info, vehicle details, and status
 * Shows assignment dropdown for admins
 */
export const EnhancedDriverSection: React.FC<EnhancedDriverSectionProps> = ({
  order,
  assignedAgent,
  drivers = [],
  isAdmin = false,
  onAssignDriver,
  assigningDriver = false
}) => {
  const hasAssignedDriver = assignedAgent && assignedAgent.id;
  
  // Get driver initials for avatar fallback
  const getDriverInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'D';
  };

  // Get driver status badge
  const getDriverStatus = () => {
    if (!hasAssignedDriver) return null;
    
    const isActive = assignedAgent.is_active;
    const orderStatus = order?.status;
    
    if (orderStatus === 'out_for_delivery') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">En Route</Badge>;
    } else if (orderStatus === 'delivered') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Delivered</Badge>;
    } else if (isActive) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Assigned</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>;
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
        <User className="h-4 w-4" />
        Assigned Driver
      </h3>

      {hasAssignedDriver ? (
        <div className="bg-muted/50 rounded-lg p-4 space-y-4">
          {/* Driver Info */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={assignedAgent.avatar_url || ''} alt={assignedAgent.name} />
              <AvatarFallback>{getDriverInitials(assignedAgent.name)}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-foreground">{assignedAgent.name || 'Driver'}</h4>
                {getDriverStatus()}
              </div>
              
              {assignedAgent.phone && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <a href={`tel:${assignedAgent.phone}`} className="hover:text-foreground">
                    {assignedAgent.phone}
                  </a>
                </div>
              )}
              
              {assignedAgent.vehicle_type && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Car className="h-3 w-3" />
                  {assignedAgent.vehicle_type}
                </div>
              )}
              
              {assignedAgent.current_location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {assignedAgent.current_location}
                </div>
              )}
            </div>
          </div>

          {/* Admin Driver Reassignment */}
          {isAdmin && drivers.length > 0 && (
            <div className="border-t pt-3">
              <label className="text-sm font-medium text-foreground">Reassign Driver</label>
              <Select
                value={order?.assigned_rider_id || ''}
                onValueChange={onAssignDriver}
                disabled={assigningDriver}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a different driver..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassign driver</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <div className="flex items-center gap-2">
                        <span>{driver.name}</span>
                        {driver.vehicle_type && (
                          <span className="text-xs text-muted-foreground">
                            ({driver.vehicle_type})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-center py-4">
            <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No driver assigned</p>
            
            {/* Admin Driver Assignment */}
            {isAdmin && drivers.length > 0 && (
              <div className="mt-4">
                <Select
                  value=""
                  onValueChange={onAssignDriver}
                  disabled={assigningDriver}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign a driver..." />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <span>{driver.name}</span>
                          {driver.vehicle_type && (
                            <span className="text-xs text-muted-foreground">
                              ({driver.vehicle_type})
                            </span>
                          )}
                          {!driver.is_active && (
                            <Badge variant="destructive" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {isAdmin && drivers.length === 0 && (
              <p className="text-xs text-destructive mt-2">No active drivers available</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};