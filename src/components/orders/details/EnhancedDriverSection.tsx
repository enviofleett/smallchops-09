import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Phone, Car, MapPin, Clock, AlertCircle, MessageCircle, Navigation } from 'lucide-react';
import { OrderDetailsSectionErrorBoundary } from './ErrorBoundary';
import { DriverSectionSkeleton } from './LoadingSkeleton';

interface EnhancedDriverSectionProps {
  order: any;
  assignedAgent?: any;
  drivers?: any[];
  isAdmin?: boolean;
  onAssignDriver?: (driverId: string) => void;
  assigningDriver?: boolean;
  isLoading?: boolean;
}

/**
 * Enhanced driver section with avatar, contact info, vehicle details, and status
 * Shows assignment dropdown for admins with comprehensive error handling
 */
export const EnhancedDriverSection: React.FC<EnhancedDriverSectionProps> = ({
  order,
  assignedAgent,
  drivers = [],
  isAdmin = false,
  onAssignDriver,
  assigningDriver = false,
  isLoading = false
}) => {
  // Show loading skeleton if loading
  if (isLoading) {
    return <DriverSectionSkeleton />;
  }

  const hasAssignedDriver = assignedAgent && assignedAgent.id;
  
  // Get driver initials for avatar fallback with validation
  const getDriverInitials = (name: string) => {
    if (!name || typeof name !== 'string') return 'D';
    try {
      return name.trim().split(' ')
        .filter(n => n.length > 0)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'D';
    } catch {
      return 'D';
    }
  };

  // Get driver status badge with enhanced logic
  const getDriverStatus = () => {
    if (!hasAssignedDriver) return null;
    
    const isActive = assignedAgent?.is_active;
    const orderStatus = order?.status;
    const lastSeen = assignedAgent?.last_seen_at;
    
    // Check if driver was recently active (within last 30 minutes)
    const isRecentlyActive = lastSeen && 
      new Date(lastSeen).getTime() > Date.now() - (30 * 60 * 1000);
    
    if (orderStatus === 'out_for_delivery') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">En Route</Badge>;
    } else if (orderStatus === 'delivered') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Delivered</Badge>;
    } else if (orderStatus === 'cancelled') {
      return <Badge variant="secondary" className="bg-red-100 text-red-800">Cancelled</Badge>;
    } else if (isActive && isRecentlyActive) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Online</Badge>;
    } else if (isActive) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Assigned</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Offline</Badge>;
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return null;
    // Simple Nigerian phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `0${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Format vehicle info
  const getVehicleInfo = () => {
    const parts = [];
    if (assignedAgent?.vehicle_type) parts.push(assignedAgent.vehicle_type);
    if (assignedAgent?.vehicle_plate) parts.push(`(${assignedAgent.vehicle_plate})`);
    if (assignedAgent?.vehicle_color) parts.push(assignedAgent.vehicle_color);
    return parts.join(' ');
  };

  // Get estimated arrival time
  const getEstimatedArrival = () => {
    if (assignedAgent?.estimated_arrival_time) {
      try {
        const arrivalTime = new Date(assignedAgent.estimated_arrival_time);
        const now = new Date();
        const diffMinutes = Math.ceil((arrivalTime.getTime() - now.getTime()) / (1000 * 60));
        
        if (diffMinutes > 0) {
          return `${diffMinutes} min`;
        } else if (diffMinutes > -30) {
          return 'Arriving soon';
        }
      } catch {
        // Invalid date, ignore
      }
    }
    return null;
  };

  return (
    <OrderDetailsSectionErrorBoundary context="DriverSection">
      <section className="space-y-3">
        <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
          <User className="h-4 w-4" />
          Assigned Driver
        </h3>

        {hasAssignedDriver ? (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            {/* Driver Info */}
            <div className="flex items-start gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12 border-2 border-background">
                  <AvatarImage 
                    src={assignedAgent.avatar_url || assignedAgent.photo_url || ''} 
                    alt={assignedAgent.name}
                    onError={(e) => {
                      // Fallback to a default driver avatar
                      e.currentTarget.src = '';
                    }}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getDriverInitials(assignedAgent.name)}
                  </AvatarFallback>
                </Avatar>
                
                {/* Online status indicator */}
                {assignedAgent?.is_active && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
                )}
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-foreground">
                    {assignedAgent.name || 'Driver'}
                  </h4>
                  {getDriverStatus()}
                </div>
                
                {/* Contact Information */}
                <div className="space-y-1">
                  {assignedAgent.phone && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <a 
                          href={`tel:${assignedAgent.phone}`} 
                          className="hover:text-foreground font-mono"
                        >
                          {formatPhoneNumber(assignedAgent.phone)}
                        </a>
                      </div>
                      
                      {/* Quick contact actions */}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => window.open(`https://wa.me/${assignedAgent.phone.replace(/\D/g, '')}`, '_blank')}
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Vehicle Information */}
                  {getVehicleInfo() && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Car className="h-3 w-3" />
                      <span>{getVehicleInfo()}</span>
                    </div>
                  )}
                  
                  {/* Current Location */}
                  {assignedAgent.current_location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{assignedAgent.current_location}</span>
                    </div>
                  )}
                  
                  {/* Estimated Arrival */}
                  {getEstimatedArrival() && (
                    <div className="flex items-center gap-1 text-sm text-blue-600">
                      <Clock className="h-3 w-3" />
                      <span>ETA: {getEstimatedArrival()}</span>
                    </div>
                  )}
                </div>

                {/* Driver Rating */}
                {assignedAgent.rating && (
                  <div className="text-xs text-muted-foreground">
                    Rating: {assignedAgent.rating}/5.0 
                    {assignedAgent.total_deliveries && ` • ${assignedAgent.total_deliveries} deliveries`}
                  </div>
                )}
              </div>
            </div>

            {/* Admin Driver Reassignment */}
            {isAdmin && Array.isArray(drivers) && drivers.length > 0 && (
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
                          {!driver.is_active && (
                            <Badge variant="destructive" className="text-xs">Offline</Badge>
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
              {isAdmin && Array.isArray(drivers) && drivers.length > 0 && (
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
                              <Badge variant="destructive" className="text-xs">Offline</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {isAdmin && (!Array.isArray(drivers) || drivers.length === 0) && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No active drivers available for assignment.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </section>
    </OrderDetailsSectionErrorBoundary>
  );
};