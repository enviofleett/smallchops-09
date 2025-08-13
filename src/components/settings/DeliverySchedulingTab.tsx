import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Download,
  Upload,
  Save
} from 'lucide-react';

interface BusinessHours {
  open: string;
  close: string;
  is_open: boolean;
}

interface DeliverySchedulingConfig {
  minimum_lead_time_minutes: number;
  max_advance_booking_days: number;
  default_delivery_duration_minutes: number;
  allow_same_day_delivery: boolean;
  business_hours: {
    monday: BusinessHours;
    tuesday: BusinessHours;
    wednesday: BusinessHours;
    thursday: BusinessHours;
    friday: BusinessHours;
    saturday: BusinessHours;
    sunday: BusinessHours;
  };
}

interface PublicHoliday {
  id?: string;
  date: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const NIGERIAN_HOLIDAYS = [
  { name: "New Year's Day", date: "2024-01-01" },
  { name: "Good Friday", date: "2024-03-29" },
  { name: "Easter Monday", date: "2024-04-01" },
  { name: "Workers' Day", date: "2024-05-01" },
  { name: "Children's Day", date: "2024-05-27" },
  { name: "Democracy Day", date: "2024-06-12" },
  { name: "Independence Day", date: "2024-10-01" },
  { name: "Christmas Day", date: "2024-12-25" },
  { name: "Boxing Day", date: "2024-12-26" }
];

export const DeliverySchedulingTab = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<DeliverySchedulingConfig>({
    minimum_lead_time_minutes: 90,
    max_advance_booking_days: 30,
    default_delivery_duration_minutes: 120,
    allow_same_day_delivery: true,
    business_hours: {
      monday: { open: '09:00', close: '21:00', is_open: true },
      tuesday: { open: '09:00', close: '21:00', is_open: true },
      wednesday: { open: '09:00', close: '21:00', is_open: true },
      thursday: { open: '09:00', close: '21:00', is_open: true },
      friday: { open: '09:00', close: '21:00', is_open: true },
      saturday: { open: '09:00', close: '21:00', is_open: true },
      sunday: { open: '10:00', close: '20:00', is_open: true },
    }
  });
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [newHoliday, setNewHoliday] = useState<Partial<PublicHoliday>>({});
  const [selectedDate, setSelectedDate] = useState<Date>();

  useEffect(() => {
    loadConfiguration();
    loadHolidays();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('business_settings')
        .select('delivery_scheduling_config, business_hours')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.delivery_scheduling_config) {
        const configData = data.delivery_scheduling_config as any;
        setConfig(prev => ({
          ...prev,
          ...configData,
          business_hours: data.business_hours || prev.business_hours
        }));
      }
    } catch (error) {
      console.error('Failed to load delivery configuration:', error);
      toast.error('Failed to load delivery configuration');
    } finally {
      setLoading(false);
    }
  };

  const loadHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('public_holidays')
        .select('*')
        .eq('is_active', true)
        .order('date');

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Failed to load holidays:', error);
      toast.error('Failed to load holidays');
    }
  };

  const saveConfiguration = async () => {
    try {
      setSaving(true);
      
      // Update or insert business settings
      const { error } = await supabase
        .from('business_settings')
        .upsert({
          delivery_scheduling_config: config as any,
          business_hours: config.business_hours as any,
          updated_at: new Date().toISOString()
        } as any);

      if (error) throw error;
      
      toast.success('Delivery scheduling configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast.error('Please provide holiday name and date');
      return;
    }

    try {
      const { error } = await supabase
        .from('public_holidays')
        .insert({
          name: newHoliday.name,
          date: newHoliday.date,
          description: newHoliday.description,
          is_active: true
        });

      if (error) throw error;
      
      toast.success('Holiday added successfully');
      setNewHoliday({});
      loadHolidays();
    } catch (error) {
      console.error('Failed to add holiday:', error);
      toast.error('Failed to add holiday');
    }
  };

  const removeHoliday = async (id: string) => {
    try {
      const { error } = await supabase
        .from('public_holidays')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Holiday removed successfully');
      loadHolidays();
    } catch (error) {
      console.error('Failed to remove holiday:', error);
      toast.error('Failed to remove holiday');
    }
  };

  const addNigerianHolidays = async () => {
    try {
      const holidaysToAdd = NIGERIAN_HOLIDAYS.filter(
        holiday => !holidays.some(h => h.date === holiday.date)
      );

      if (holidaysToAdd.length === 0) {
        toast.info('All Nigerian holidays are already configured');
        return;
      }

      const { error } = await supabase
        .from('public_holidays')
        .insert(
          holidaysToAdd.map(holiday => ({
            ...holiday,
            is_active: true
          }))
        );

      if (error) throw error;
      
      toast.success(`Added ${holidaysToAdd.length} Nigerian holidays`);
      loadHolidays();
    } catch (error) {
      console.error('Failed to add Nigerian holidays:', error);
      toast.error('Failed to add Nigerian holidays');
    }
  };

  const updateBusinessHours = (day: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: {
          ...prev.business_hours[day as keyof typeof prev.business_hours],
          [field]: value
        }
      }
    }));
  };

  const getOpenDaysCount = () => {
    return Object.values(config.business_hours).filter(day => day.is_open).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Delivery Scheduling Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Manage business hours, holidays, and delivery policies
          </p>
        </div>
        <Button onClick={saveConfiguration} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      <Tabs defaultValue="business-hours" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="business-hours">Business Hours</TabsTrigger>
          <TabsTrigger value="holidays">Public Holidays</TabsTrigger>
          <TabsTrigger value="policies">Delivery Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="business-hours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Business Hours Configuration
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{getOpenDaysCount()} days open</Badge>
                <Badge variant="secondary">
                  {config.business_hours.sunday.is_open ? 'Open Sundays' : 'Closed Sundays'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {DAYS_OF_WEEK.map(({ key, label }) => {
                const dayHours = config.business_hours[key as keyof typeof config.business_hours];
                return (
                  <div key={key} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="w-24">
                      <Label className="font-medium">{label}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={dayHours.is_open}
                        onCheckedChange={(checked) => updateBusinessHours(key, 'is_open', checked)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {dayHours.is_open ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    {dayHours.is_open && (
                      <>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Open:</Label>
                          <Input
                            type="time"
                            value={dayHours.open}
                            onChange={(e) => updateBusinessHours(key, 'open', e.target.value)}
                            className="w-32"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Close:</Label>
                          <Input
                            type="time"
                            value={dayHours.close}
                            onChange={(e) => updateBusinessHours(key, 'close', e.target.value)}
                            className="w-32"
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Business hours determine when delivery slots are available. 
                  Changes will apply to all future delivery scheduling.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Holiday
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Holiday Name</Label>
                  <Input
                    placeholder="e.g., Christmas Day"
                    value={newHoliday.name || ''}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newHoliday.date ? format(parseISO(newHoliday.date), 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newHoliday.date ? parseISO(newHoliday.date) : undefined}
                        onSelect={(date) => setNewHoliday(prev => ({ 
                          ...prev, 
                          date: date ? format(date, 'yyyy-MM-dd') : '' 
                        }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input
                    placeholder="Additional details"
                    value={newHoliday.description || ''}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addHoliday} className="flex-1">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Holiday
                  </Button>
                  <Button onClick={addNigerianHolidays} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Add Nigerian Holidays
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Configured Holidays ({holidays.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {holidays.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      No holidays configured. Add holidays to block delivery on specific dates.
                    </p>
                  ) : (
                    holidays.map((holiday) => (
                      <div key={holiday.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{holiday.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(parseISO(holiday.date), 'PPP')}
                          </div>
                          {holiday.description && (
                            <div className="text-xs text-muted-foreground">{holiday.description}</div>
                          )}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeHoliday(holiday.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Delivery Policies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Lead Time (minutes)</Label>
                  <Input
                    type="number"
                    value={config.minimum_lead_time_minutes}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      minimum_lead_time_minutes: parseInt(e.target.value) || 90 
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum time required between order placement and delivery
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Maximum Advance Booking (days)</Label>
                  <Input
                    type="number"
                    value={config.max_advance_booking_days}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      max_advance_booking_days: parseInt(e.target.value) || 30 
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    How far in advance customers can book deliveries
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Default Delivery Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={config.default_delivery_duration_minutes}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      default_delivery_duration_minutes: parseInt(e.target.value) || 120 
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Standard delivery window duration
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Allow Same-Day Delivery</Label>
                    <Switch
                      checked={config.allow_same_day_delivery}
                      onCheckedChange={(checked) => setConfig(prev => ({ 
                        ...prev, 
                        allow_same_day_delivery: checked 
                      }))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Allow customers to book delivery for the same day
                  </p>
                </div>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Current Configuration:</strong> Customers can book deliveries 
                  {config.minimum_lead_time_minutes} minutes in advance, up to 
                  {config.max_advance_booking_days} days ahead, with 
                  {config.default_delivery_duration_minutes}-minute delivery windows.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};