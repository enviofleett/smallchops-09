import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderUpdateMonitor } from './OrderUpdateMonitor';
import { SystemHealthIndicator } from './SystemHealthIndicator';
import { Shield, Activity, Database, CheckCircle } from 'lucide-react';

export const OrderSystemDashboard = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Enhanced Order Management System
          </CardTitle>
          <p className="text-muted-foreground">
            Real-time monitoring of the bulletproof order update system with distributed locking and idempotency controls.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <div className="font-semibold text-green-800">Concurrent Safety</div>
                <div className="text-sm text-green-600">Distributed locks prevent conflicts</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <div className="font-semibold text-blue-800">Idempotency</div>
                <div className="text-sm text-blue-600">Duplicate requests cached safely</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
              <Activity className="w-8 h-8 text-purple-600" />
              <div>
                <div className="font-semibold text-purple-800">Real-time Monitoring</div>
                <div className="text-sm text-purple-600">Live system health tracking</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SystemHealthIndicator />
      
      <OrderUpdateMonitor />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            System Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Concurrency Protection</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Distributed locking prevents simultaneous updates</li>
                <li>• Session-based lock management</li>
                <li>• Automatic lock expiration and cleanup</li>
                <li>• Race condition elimination</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Idempotency & Caching</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Client-side request deduplication</li>
                <li>• Server-side response caching</li>
                <li>• Enhanced debouncing (2-second minimum)</li>
                <li>• Collision-resistant key generation</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Error Recovery</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Comprehensive audit logging</li>
                <li>• Automatic retry mechanisms</li>
                <li>• Graceful failure handling</li>
                <li>• User-friendly error messages</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Monitoring & Analytics</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Real-time system health metrics</li>
                <li>• Performance monitoring</li>
                <li>• Error rate tracking</li>
                <li>• Lock and cache analytics</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};