import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Settings, Info, CheckCircle, Mail } from 'lucide-react';

interface EmailMigrationNoticeProps {
  onNavigateToEmailManagement: () => void;
  currentLocation: 'settings' | 'admin';
}

export const EmailMigrationNotice: React.FC<EmailMigrationNoticeProps> = ({
  onNavigateToEmailManagement,
  currentLocation
}) => {
  return (
    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800 dark:text-blue-200">
        <div className="space-y-3">
          <div>
            <strong>Email Management Upgrade Available</strong>
            <p className="text-sm mt-1">
              We've created a comprehensive Email Management interface with advanced features.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <h4 className="font-medium mb-1">Current (Basic):</h4>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>• Basic SMTP configuration</li>
                <li>• Simple testing</li>
                <li>• Limited visibility</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-1">New (Comprehensive):</h4>
              <ul className="space-y-0.5 text-green-600 dark:text-green-400">
                <li>• Advanced SMTP settings</li>
                <li>• Email template management</li>
                <li>• Delivery analytics</li>
                <li>• Queue management</li>
                <li>• Professional testing tools</li>
              </ul>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <Button 
              onClick={onNavigateToEmailManagement}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="mr-2 h-3 w-3" />
              Open Email Management
              <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
            <Badge variant="secondary" className="text-xs">
              Recommended
            </Badge>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};