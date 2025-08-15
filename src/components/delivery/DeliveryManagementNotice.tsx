import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Truck, ArrowRight, Package, Users, MapPin, Clock } from 'lucide-react';

export function DeliveryManagementNotice() {
  const navigate = useNavigate();

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Truck className="h-6 w-6 text-blue-600" />
          </div>
          
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                New Delivery Management System Available!
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Access comprehensive delivery management features including driver assignment, 
                status tracking, and urgent delivery filtering.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2 text-gray-600">
                <Package className="w-4 h-4" />
                <span>Order Management</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-4 h-4" />
                <span>Driver Assignment</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Urgent Filtering</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>Zone Management</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => navigate('/admin/delivery')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Go to Delivery Management
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => navigate('/admin/orders')}
              >
                View All Orders
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}