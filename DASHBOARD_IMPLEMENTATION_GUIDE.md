# Dashboard Implementation Guide

## Best Practice: Unified Admin Dashboard with Tabs

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           Admin Dashboard (Main Route)              │
├─────────────────────────────────────────────────────┤
│  [Overview] [Analytics] [Production] [Email]        │ <- Tabs
├─────────────────────────────────────────────────────┤
│                                                      │
│  Tab 1: Overview (Business Metrics)                 │
│    - Stats Cards (Orders, Revenue, Customers)       │
│    - Fulfillment Statistics                         │
│    - Top Products & Customers                       │
│                                                      │
│  Tab 2: Analytics (Detailed Insights)               │
│    - Revenue Trends Chart                           │
│    - Customer Segmentation                          │
│    - Weekday Sales Analysis                         │
│    - Weekly Fulfillment Trends                      │
│                                                      │
│  Tab 3: Production Health                           │
│    - System Status (Database, Payments, Errors)     │
│    - Real-time Monitoring                           │
│    - Performance Metrics                            │
│                                                      │
│  Tab 4: Email Management                            │
│    - Email System Status                            │
│    - Delivery Monitor                               │
│    - Template Management Link                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Implementation Strategy

### Option A: Tabbed Dashboard (RECOMMENDED)
**Best for:** Organizing multiple data sources without overwhelming users

**Pros:**
- Clean organization by category
- Lazy loading of heavy components
- Easy to add new sections
- Better performance (only loads active tab)

**Implementation:**
```typescript
// src/pages/admin/UnifiedDashboard.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Overview } from "@/components/admin/dashboard/Overview"
import { Analytics } from "@/components/admin/dashboard/Analytics"
import { ProductionHealth } from "@/components/admin/dashboard/ProductionHealth"
import { EmailManagement } from "@/components/admin/dashboard/EmailManagement"

export default function UnifiedDashboard() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Complete overview of your business</p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="analytics"><Analytics /></TabsContent>
        <TabsContent value="production"><ProductionHealth /></TabsContent>
        <TabsContent value="email"><EmailManagement /></TabsContent>
      </Tabs>
    </div>
  )
}
```

### Option B: Scrollable Single Page
**Best for:** Users who want to see everything at once

**Pros:**
- All data visible without clicking
- Good for high-level monitoring
- Easy to print/screenshot

**Cons:**
- Slower initial load
- Can feel overwhelming
- Higher memory usage

### Option C: Card-Based Dashboard with Collapsible Sections
**Best for:** Maximum flexibility and customization

**Pros:**
- Users can expand/collapse sections
- Customizable layout
- Clean when collapsed

**Cons:**
- More complex state management
- Requires localStorage for preferences

## Data Hook Strategy

### Current Hooks:
1. **`useDashboardData`** - Business metrics (orders, revenue, trends)
2. **`useAdminDashboardData`** - Admin-specific data (products, fulfillment)
3. Need to create: **`useProductionHealth`** - System health metrics

### Recommended Data Flow:
```typescript
// src/hooks/useDashboardData.ts
// ✅ Already exists - handles business metrics

// src/hooks/useAdminDashboardData.ts  
// ✅ Already exists - handles admin-specific data

// src/hooks/useProductionHealth.ts
// ❌ Need to create - handles system health
export const useProductionHealth = () => {
  return useQuery({
    queryKey: ['production-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_production_health_status')
      
      if (error) throw error
      return data
    },
    refetchInterval: 30000 // Auto-refresh every 30s
  })
}
```

## Component Structure

### Refactor into focused components:
```
src/components/admin/dashboard/
├── Overview.tsx              (Stats cards, top performers)
├── Analytics.tsx             (Charts, trends, segmentation)
├── ProductionHealth.tsx      (System status, monitoring)
├── EmailManagement.tsx       (Email system overview)
├── StatsCards.tsx           (Reusable stat card grid)
├── FulfillmentOverview.tsx  (Consolidated fulfillment data)
└── TopPerformers.tsx        (Products & customers)
```

## Migration Path

### Phase 1: Create Unified Dashboard
1. Create `src/pages/admin/UnifiedDashboard.tsx` with tabs
2. Extract components from existing dashboards into tab components
3. Keep current dashboards unchanged

### Phase 2: Migrate Components
1. Create focused components in `admin/dashboard/` folder
2. Move logic from `ProductionDashboard.tsx` to `ProductionHealth.tsx`
3. Consolidate fulfillment components

### Phase 3: Update Routes
1. Update App.tsx to point `/admin/dashboard` to new UnifiedDashboard
2. Deprecate old dashboard routes
3. Update sidebar navigation

### Phase 4: Polish
1. Add loading states for each tab
2. Add error boundaries
3. Implement auto-refresh for production metrics
4. Add export/print functionality

## Key Considerations

### Performance:
- ✅ Use React Query for caching
- ✅ Lazy load tab content
- ✅ Implement pagination for large lists
- ✅ Debounce auto-refresh

### User Experience:
- ✅ Show loading skeletons
- ✅ Handle empty states gracefully
- ✅ Add refresh buttons for manual updates
- ✅ Persist tab selection in URL params

### Data Accuracy:
- ✅ Use consistent time ranges across all metrics
- ✅ Add "Last updated" timestamps
- ✅ Validate data before displaying
- ✅ Show data source/freshness indicators

## Next Steps

1. **Decide on structure:** Tab-based, scrollable, or card-based?
2. **Create component structure:** Organize components by concern
3. **Implement unified dashboard:** Start with tabs
4. **Migrate existing components:** Move logic into new structure
5. **Test with real data:** Ensure all metrics display correctly
6. **Add polish:** Loading states, animations, responsiveness
