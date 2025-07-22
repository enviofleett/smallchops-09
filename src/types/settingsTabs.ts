
import { LucideIcon } from 'lucide-react';

export interface SettingsTab {
  value: string;
  label: string;
  icon: LucideIcon;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  category?: 'business' | 'operations' | 'technical' | 'system';
  description?: string;
  requiresOnline?: boolean;
}

export interface TabCategory {
  id: string;
  label: string;
  description: string;
  tabs: SettingsTab[];
}
