import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Clock, Users, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DeliverySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  is_available: boolean;
}

export const DeliveryCapacityManager: React.FC = () => {
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newCapacity, setNewCapacity] = useState('20');

  const loadSlots = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_time_slots')
        .select('*')
        .eq('date', selectedDate)
        .order('start_time');

      if (error) throw error;
      setSlots(data || []);
    } catch (error) {
      console.error('Error loading slots:', error);
      toast.error('Failed to load delivery slots');
    } finally {
      setLoading(false);
    }
  };

  const updateSlotCapacity = async (slotId: string, capacity: number) => {
    try {
      const { error } = await supabase
        .from('delivery_time_slots')
        .update({ max_capacity: capacity })
        .eq('id', slotId);

      if (error) throw error;
      
      toast.success('Slot capacity updated');
      loadSlots();
    } catch (error) {
      console.error('Error updating capacity:', error);
      toast.error('Failed to update capacity');
    }
  };

  const regenerateSlots = async () => {
    try {
      setLoading(true);
      const startDate = selectedDate;
      const endDate = format(new Date(new Date(selectedDate).getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      
      const { error } = await supabase.rpc('populate_delivery_slots', {
        start_date: startDate,
        end_date: endDate
      });

      if (error) throw error;
      
      toast.success('Delivery slots regenerated');
      loadSlots();
    } catch (error) {
      console.error('Error regenerating slots:', error);
      toast.error('Failed to regenerate slots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, [selectedDate]);

  const getUtilizationColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const totalCapacity = slots.reduce((sum, slot) => sum + slot.max_capacity, 0);
  const totalBookings = slots.reduce((sum, slot) => sum + slot.current_bookings, 0);
  const utilizationRate = totalCapacity > 0 ? (totalBookings / totalCapacity) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Delivery Capacity Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="date">Select Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="flex gap-2 items-end">
              <Button onClick={loadSlots} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={regenerateSlots} variant="outline" size="sm">
                Generate Slots
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Slots</p>
                    <p className="text-2xl font-bold">{slots.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Capacity</p>
                    <p className="text-2xl font-bold">{totalCapacity}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bookings</p>
                    <p className="text-2xl font-bold">{totalBookings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className={`h-4 w-4 ${utilizationRate >= 80 ? 'text-red-500' : 'text-blue-500'}`} />
                  <div>
                    <p className="text-sm text-muted-foreground">Utilization</p>
                    <p className="text-2xl font-bold">{utilizationRate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {utilizationRate >= 90 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                High utilization rate! Consider adding more capacity or slots.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Slots Management */}
      <Card>
        <CardHeader>
          <CardTitle>Time Slots for {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No delivery slots found for this date</p>
              <Button onClick={regenerateSlots} className="mt-4">
                Generate Slots
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getUtilizationColor(slot.current_bookings, slot.max_capacity)}`}
                          style={{ width: `${Math.min((slot.current_bookings / slot.max_capacity) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {slot.current_bookings}/{slot.max_capacity}
                      </span>
                    </div>

                    <Badge variant={slot.is_available ? "secondary" : "destructive"}>
                      {slot.is_available ? "Available" : "Full"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={slot.max_capacity}
                      onChange={(e) => {
                        const newCapacity = parseInt(e.target.value);
                        if (newCapacity > 0) {
                          updateSlotCapacity(slot.id, newCapacity);
                        }
                      }}
                      className="w-20"
                      min="1"
                      max="100"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      max capacity
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};