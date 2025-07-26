import React, { useState, useEffect } from 'react';
import { X, Bell, Mail, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationPreferencesProps {
  customerId: string;
  onClose: () => void;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  customerId,
  onClose,
}) => {
  const { preferences, isLoading, updatePreferences, isUpdating } = useNotificationPreferences(customerId);
  
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [promotionAlerts, setPromotionAlerts] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState('weekly');
  const [minDiscountPercentage, setMinDiscountPercentage] = useState([5]);

  useEffect(() => {
    if (preferences) {
      setPriceAlerts(preferences.price_alerts);
      setPromotionAlerts(preferences.promotion_alerts);
      setDigestFrequency(preferences.digest_frequency);
      setMinDiscountPercentage([preferences.minimum_discount_percentage]);
    }
  }, [preferences]);

  const handleSave = () => {
    updatePreferences({
      customer_id: customerId,
      price_alerts: priceAlerts,
      promotion_alerts: promotionAlerts,
      digest_frequency: digestFrequency,
      minimum_discount_percentage: minDiscountPercentage[0],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="price-alerts" className="flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Price Drop Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when favorite products drop in price
                    </p>
                  </div>
                  <Switch
                    id="price-alerts"
                    checked={priceAlerts}
                    onCheckedChange={setPriceAlerts}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="promotion-alerts" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Promotion Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about promotions on favorites
                    </p>
                  </div>
                  <Switch
                    id="promotion-alerts"
                    checked={promotionAlerts}
                    onCheckedChange={setPromotionAlerts}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Digest Frequency</Label>
                  <Select value={digestFrequency} onValueChange={setDigestFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    How often you receive summary emails
                  </p>
                </div>

                {priceAlerts && (
                  <div className="space-y-3">
                    <Label>Minimum Discount Percentage</Label>
                    <div className="px-2">
                      <Slider
                        value={minDiscountPercentage}
                        onValueChange={setMinDiscountPercentage}
                        max={50}
                        min={1}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Only notify for discounts of {minDiscountPercentage[0]}% or more
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isUpdating}
                  className="flex-1"
                >
                  {isUpdating ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};