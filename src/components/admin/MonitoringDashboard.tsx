import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, Shield } from 'lucide-react';

export const MonitoringDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-6 h-6" />
            System Monitoring
          </CardTitle>
          <p className="text-muted-foreground">
            Enhanced order management system monitoring dashboard.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-green-600" />
                <div>
                  <div className="font-semibold text-green-800">Database</div>
                  <div className="text-sm text-green-600">Operational</div>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Healthy</Badge>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="font-semibold text-blue-800">Security</div>
                  <div className="text-sm text-blue-600">Protected</div>
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Active</Badge>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-purple-600" />
                <div>
                  <div className="font-semibold text-purple-800">Performance</div>
                  <div className="text-sm text-purple-600">Optimized</div>
                </div>
              </div>
              <Badge className="bg-purple-100 text-purple-800">Good</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};