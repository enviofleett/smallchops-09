
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldCheck, Users } from 'lucide-react';

const AdminCheckoutSettingsCard: React.FC = () => {
  const { data: settings, isLoading, invalidateSettings } = useBusinessSettings();
  const [saving, setSaving] = useState(false);
  const [allowGuest, setAllowGuest] = useState<boolean>(settings?.allow_guest_checkout !== false);

  React.useEffect(() => {
    setAllowGuest(settings?.allow_guest_checkout !== false);
  }, [settings?.allow_guest_checkout]);

  const description = useMemo(() => {
    return allowGuest
      ? 'Guests can checkout without creating an account. Email and phone are still required for order updates.'
      : 'Only signed-in customers can checkout. Useful when enabling loyalty, saved addresses, or B2B rules.';
  }, [allowGuest]);

  const onSave = async () => {
    if (!settings?.name) {
      toast.error('Business settings not loaded yet.');
      return;
    }
    setSaving(true);
    try {
      // business-settings POST requires name; send minimal safe payload
      const { data, error } = await supabase.functions.invoke('business-settings', {
        body: {
          name: settings.name,
          allow_guest_checkout: allowGuest
        }
      });

      if (error) {
        console.error('Failed to update business settings:', error);
        toast.error(error.message || 'Failed to save setting');
        return;
      }

      toast.success(`Guest checkout ${allowGuest ? 'enabled' : 'disabled'}`);
      await invalidateSettings();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">Checkout Settings</h3>
            <p className="text-sm text-muted-foreground">Control whether guests can place orders without signing in.</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="allow-guest" className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Allow guest checkout
            </Label>
            <p className="text-xs text-muted-foreground max-w-prose">
              {description}
            </p>
          </div>
          <Switch
            id="allow-guest"
            checked={allowGuest}
            onCheckedChange={(v) => setAllowGuest(!!v)}
            disabled={isLoading || saving}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving || isLoading}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCheckoutSettingsCard;
