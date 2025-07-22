
import React from 'react';
import { Button } from '@/components/ui/button';

interface BusinessFormActionsProps {
  saving: boolean;
  uploadingLogo: boolean;
  disabled: boolean;
}

const BusinessFormActions: React.FC<BusinessFormActionsProps> = ({
  saving,
  uploadingLogo,
  disabled
}) => {
  return (
    <div className="pt-2">
      <Button 
        type="submit" 
        className="px-7 rounded-lg text-base font-medium" 
        disabled={saving || uploadingLogo || disabled}
      >
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
};

export default BusinessFormActions;
