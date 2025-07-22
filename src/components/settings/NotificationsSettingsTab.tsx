
import React from 'react';
import { Switch } from '@/components/ui/switch';

const NotificationsSettingsTab = () => {
  const notificationItems = [
    { id: 'new-orders', label: 'New Orders', description: 'Get notified when new orders are placed' },
    { id: 'low-stock', label: 'Low Stock', description: 'Alert when products are running low' },
    { id: 'customer-messages', label: 'Customer Messages', description: 'Receive customer support messages' },
    { id: 'weekly-reports', label: 'Weekly Reports', description: 'Get weekly performance summaries' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          {notificationItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-800">{item.label}</p>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
              <Switch id={item.id} defaultChecked />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationsSettingsTab;
