import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, User, MapPin, Settings, ShoppingBag, Heart, Clock } from 'lucide-react';
import { useProfileActivity } from '@/hooks/useCustomerProfile';
import { format, formatDistanceToNow } from 'date-fns';

export function ProfileActivityLog() {
  const { activity: activities = [], isLoading } = useProfileActivity();

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'profile_update':
        return <User className="w-4 h-4 text-blue-600" />;
      case 'address_added':
      case 'address_updated':
      case 'address_deleted':
        return <MapPin className="w-4 h-4 text-green-600" />;
      case 'preferences_updated':
        return <Settings className="w-4 h-4 text-purple-600" />;
      case 'order_placed':
        return <ShoppingBag className="w-4 h-4 text-orange-600" />;
      case 'favorite_added':
      case 'favorite_removed':
        return <Heart className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActivityColor = (actionType: string) => {
    switch (actionType) {
      case 'profile_update':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'address_added':
      case 'address_updated':
      case 'address_deleted':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'preferences_updated':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'order_placed':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'favorite_added':
      case 'favorite_removed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getActivityDescription = (activity: any) => {
    const { action_type, field_changed, old_value, new_value } = activity;
    
    switch (action_type) {
      case 'profile_update':
        if (field_changed && old_value && new_value) {
          return `Updated ${field_changed} from "${old_value}" to "${new_value}"`;
        }
        return 'Updated profile information';
      
      case 'address_added':
        return `Added new address${new_value ? `: ${new_value}` : ''}`;
      
      case 'address_updated':
        return `Updated delivery address`;
      
      case 'address_deleted':
        return 'Deleted delivery address';
      
      case 'preferences_updated':
        return 'Updated notification preferences';
      
      case 'order_placed':
        return `Placed new order${new_value ? `: ${new_value}` : ''}`;
      
      case 'favorite_added':
        return `Added item to favorites${new_value ? `: ${new_value}` : ''}`;
      
      case 'favorite_removed':
        return `Removed item from favorites${old_value ? `: ${old_value}` : ''}`;
      
      default:
        return action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mt-0.5">
                  {getActivityIcon(activity.action_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {getActivityDescription(activity)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getActivityColor(activity.action_type)}`}
                        >
                          {activity.action_type.replace(/_/g, ' ')}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span title={format(new Date(activity.created_at), 'PPpp')}>
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
            <p className="text-muted-foreground">
              Your account activity will appear here as you use the platform.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}