
import { lazy } from 'react';
import { 
  Building, 
  Users, 
  CreditCard, 
  MessageSquare, 
  Code, 
  FileText, 
  Truck, 
  ListChecks, 
  Contact, 
  Map, 
  AlertTriangle 
} from 'lucide-react';
import type { SettingsTab, TabCategory } from '@/types/settingsTabs';

// Lazy load all tab components
const BusinessTabContent = lazy(() => import('@/components/settings/business/BusinessTabContent'));
const UsersTab = lazy(() => import('@/components/settings/UsersTab'));
const PaymentTab = lazy(() => import('@/components/settings/PaymentTab'));
const CommunicationTab = lazy(() => import('@/components/settings/CommunicationTab'));
const CommunicationLogsTab = lazy(() => import('@/components/settings/communication/CommunicationLogsTab'));
const CustomerPreferencesTab = lazy(() => import('@/components/settings/CustomerPreferencesTab'));
const DeliveryManagementTab = lazy(() => import('@/components/settings/DeliveryManagementTab'));
const DeliveryVehiclesTab = lazy(() => import('@/components/settings/DeliveryVehiclesTab'));
const EnvioApiTab = lazy(() => import('@/components/settings/EnvioApiTab'));
const MapApiTab = lazy(() => import('@/components/settings/MapApiTab'));
const ContentManagementTab = lazy(() => import('@/components/settings/ContentManagementTab'));
const ProductionHealthTab = lazy(() => import('@/components/settings/ProductionHealthTab'));
const DevelopersCornerTab = lazy(() => import('@/components/settings/DevelopersCornerTab'));

export const SETTINGS_TABS: SettingsTab[] = [
  {
    value: "business",
    label: "Business",
    icon: Building,
    component: BusinessTabContent,
    category: 'business',
    description: "Basic business information and branding"
  },
  {
    value: "users",
    label: "Users",
    icon: Users,
    component: UsersTab,
    category: 'business',
    description: "Manage user accounts and permissions"
  },
  {
    value: "payment",
    label: "Payment",
    icon: CreditCard,
    component: PaymentTab,
    category: 'business',
    description: "Payment processing settings"
  },
  {
    value: "communication",
    label: "Communication",
    icon: MessageSquare,
    component: CommunicationTab,
    category: 'operations',
    description: "Email and SMS configuration"
  },
  {
    value: "communication-logs",
    label: "Comm. Logs",
    icon: ListChecks,
    component: CommunicationLogsTab,
    category: 'operations',
    description: "Communication history and logs"
  },
  {
    value: "customer-preferences",
    label: "Customer Prefs",
    icon: Contact,
    component: CustomerPreferencesTab,
    category: 'operations',
    description: "Customer communication preferences"
  },
  {
    value: "delivery",
    label: "Delivery",
    icon: Truck,
    component: DeliveryManagementTab,
    category: 'operations',
    description: "Delivery zones and settings"
  },
  {
    value: "vehicles",
    label: "Delivery Vehicles",
    icon: Truck,
    component: DeliveryVehiclesTab,
    category: 'operations',
    description: "Manage delivery fleet"
  },
  {
    value: "envioapi",
    label: "Envio API",
    icon: Code,
    component: EnvioApiTab,
    category: 'technical',
    description: "Shipping API configuration",
    requiresOnline: true
  },
  {
    value: "mapapi",
    label: "Map API",
    icon: Map,
    component: MapApiTab,
    category: 'technical',
    description: "Map services configuration",
    requiresOnline: true
  },
  {
    value: "content",
    label: "Content",
    icon: FileText,
    component: ContentManagementTab,
    category: 'technical',
    description: "Website content management"
  },
  {
    value: "health",
    label: "Production Health",
    icon: AlertTriangle,
    component: ProductionHealthTab,
    category: 'system',
    description: "System health monitoring"
  },
  {
    value: "developers-corner",
    label: "Developers Corner",
    icon: Code,
    component: DevelopersCornerTab,
    category: 'system',
    description: "Developer tools and API documentation"
  },
];

export const TAB_CATEGORIES: TabCategory[] = [
  {
    id: 'business',
    label: 'Business',
    description: 'Core business settings and user management',
    tabs: SETTINGS_TABS.filter(tab => tab.category === 'business')
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Day-to-day operational settings',
    tabs: SETTINGS_TABS.filter(tab => tab.category === 'operations')
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'API integrations and technical configurations',
    tabs: SETTINGS_TABS.filter(tab => tab.category === 'technical')
  },
  {
    id: 'system',
    label: 'System',
    description: 'System monitoring and developer tools',
    tabs: SETTINGS_TABS.filter(tab => tab.category === 'system')
  }
];
