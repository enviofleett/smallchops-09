
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
  return (
    <Card className="border">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold">Checkout Settings</h3>
            <p className="text-sm text-muted-foreground">Authentication is required for all customers to place orders.</p>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-muted/30">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Account Required</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-prose">
              All customers must sign in or create an account to place orders. This ensures better order tracking, customer support, and enables features like saved addresses and order history.
            </p>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Guest checkout has been disabled to ensure better customer experience and order management.
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCheckoutSettingsCard;
