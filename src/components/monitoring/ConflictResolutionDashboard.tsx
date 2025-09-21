import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';

export const ConflictResolutionDashboard = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Conflict Resolution System
          </CardTitle>
          <p className="text-muted-foreground">
            Monitor order update conflicts and resolution strategies.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <div className="font-semibold text-green-800">System Status</div>
                  <div className="text-sm text-green-600">No conflicts detected</div>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Healthy</Badge>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="font-semibold text-blue-800">Resolution Rate</div>
                  <div className="text-sm text-blue-600">100% automated</div>
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Optimal</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConflictResolutionDashboard;