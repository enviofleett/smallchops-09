import React from 'react';
import { Wifi, WifiOff, Signal } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetwork } from './NetworkProvider';

export const OnlineStatusBanner: React.FC = () => {
  // Disabled for production - no network status banners
  return null;
};