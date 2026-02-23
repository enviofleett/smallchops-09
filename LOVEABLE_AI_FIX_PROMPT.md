# Loveable AI Fix Prompt: Admin Orders Architecture Refactoring

## 🚨 Critical Issue Summary
The `/admin/orders` route has a **massive 1,169-line monolithic component** with severe architectural problems that need immediate refactoring. This affects performance, maintainability, and user experience.

## 🎯 Specific Tasks for Loveable AI

### **PHASE 1: IMMEDIATE CRITICAL FIXES** ⚡

#### 1. **Break Down Monolithic Component** (Priority: CRITICAL)
```
TASK: Split AdminOrders.tsx (1,169 lines) into logical sub-components

CREATE these new files:
- src/pages/admin/orders/AdminOrdersPage.tsx (main orchestrator, <200 lines)
- src/components/admin/orders/OrderFilters.tsx (search, date, status filters)
- src/components/admin/orders/OrdersList.tsx (virtualized list of orders)
- src/components/admin/orders/OrderCard.tsx (individual order display)
- src/components/admin/orders/OrderActions.tsx (status update buttons)
- src/components/admin/orders/OrderStats.tsx (statistics dashboard)
- src/hooks/admin/useOrdersData.ts (data fetching logic)
- src/hooks/admin/useOrderFilters.ts (filter state management)
- src/utils/admin/orderSorting.ts (pure sorting functions)
- src/utils/admin/orderFiltering.ts (pure filtering functions)

CONSTRAINTS:
- Each component must be <200 lines
- Extract all business logic into pure functions
- Maintain existing functionality exactly
- Use proper TypeScript interfaces
```

#### 2. **Fix Performance Bottlenecks** (Priority: HIGH)
```
TASK: Optimize data fetching and rendering performance

SPECIFIC FIXES:
1. Replace aggressive 30-second polling with smart invalidation:
   - Remove: refetchInterval: 30000
   - Add: Invalidate queries only on user actions (status updates, filters)

2. Implement virtual scrolling for order lists:
   - Add react-window or similar
   - Render only visible orders (10-20 at a time)
   - Maintain scroll position on updates

3. Optimize query patterns:
   - Change from `select: '*'` to specific fields needed
   - Batch delivery zone queries instead of individual ones
   - Add request deduplication

4. Fix N+1 query pattern in AdminOrderCard:
   - Pre-fetch delivery zones with orders
   - Use single query with joins instead of individual queries
```

#### 3. **Implement Proper Error Handling** (Priority: HIGH)
```
TASK: Create centralized error handling system

SPECIFIC IMPLEMENTATION:
1. Create AdminOrdersErrorBoundary.tsx that catches all order-related errors
2. Replace multiple error boundaries with single comprehensive one
3. Add proper error recovery mechanisms:
   - Retry buttons for failed operations
   - Fallback UI for missing data
   - User-friendly error messages

4. Add input validation:
   - Validate dates before creating Date objects
   - Sanitize search queries
   - Validate order status before updates
```

### **PHASE 2: ARCHITECTURE IMPROVEMENTS** 🏗️

#### 4. **Implement State Management** (Priority: MEDIUM)
```
TASK: Replace complex useState hooks with proper state management

IMPLEMENTATION:
1. Create useOrdersReducer hook:
   - Centralize all order state (filters, pagination, sorting)
   - Use reducer pattern for complex state updates
   - Add state persistence for user preferences

2. Create OrdersContext for global order state:
   - Avoid prop drilling
   - Share state between components
   - Enable optimistic updates

EXAMPLE STRUCTURE:
interface OrdersState {
  orders: OrderWithItems[];
  filters: {
    search: string;
    status: OrderStatus;
    dateRange: DateRange;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
  };
  ui: {
    selectedOrder: string | null;
    isLoading: boolean;
  };
}
```

#### 5. **Extract Business Logic** (Priority: MEDIUM)
```
TASK: Move all business logic out of components into pure functions

CREATE these utility files:
1. src/services/OrderService.ts:
   - sortOrdersByPriority()
   - filterOrdersByStatus()
   - calculateOrderStats()
   - validateOrderData()

2. src/utils/orderHelpers.ts:
   - formatOrderNumber()
   - getStatusColor()
   - calculateDeliveryTime()
   - formatCurrency()

REQUIREMENTS:
- All functions must be pure (no side effects)
- Add comprehensive unit tests
- Use proper TypeScript types
- Add JSDoc documentation
```

### **PHASE 3: DATA OPTIMIZATION** 📊

#### 6. **Optimize Data Fetching** (Priority: MEDIUM)
```
TASK: Implement efficient data fetching patterns

SPECIFIC CHANGES:
1. Create smart query hooks:
   - useOptimizedOrders() with selective field fetching
   - useOrdersWithSchedules() with joined data
   - usePaginatedOrders() with cursor-based pagination

2. Implement proper caching:
   - Set appropriate staleTime (5 minutes)
   - Use query keys with filters for cache optimization
   - Add background refetching only when needed

3. Add data normalization:
   - Store orders and schedules separately
   - Use lookup tables for related data
   - Implement efficient updates
```

#### 7. **Add Performance Monitoring** (Priority: LOW)
```
TASK: Add performance tracking and monitoring

IMPLEMENTATION:
1. Add React.memo() to expensive components
2. Use useMemo() and useCallback() strategically
3. Add performance profiling hooks
4. Track render times and re-render frequency
5. Monitor bundle size impact
```

## 🎯 **SPECIFIC CODE EXAMPLES FOR LOVEABLE AI**

### **Example 1: Component Breakdown**
```tsx
// BEFORE: Monolithic AdminOrders.tsx (1,169 lines)
function AdminOrders() {
  // 50+ lines of state
  // 100+ lines of data fetching
  // 200+ lines of filtering logic
  // 800+ lines of UI rendering
}

// AFTER: Proper component structure
// AdminOrdersPage.tsx (main orchestrator)
export default function AdminOrdersPage() {
  return (
    <AdminOrdersProvider>
      <div className="space-y-6">
        <OrdersHeader />
        <OrdersStats />
        <OrdersFilters />
        <OrdersList />
      </div>
    </AdminOrdersProvider>
  );
}

// OrdersList.tsx (focused component)
export function OrdersList() {
  const { filteredOrders, isLoading } = useOrdersContext();
  
  if (isLoading) return <OrdersListSkeleton />;
  
  return (
    <VirtualizedList
      items={filteredOrders}
      renderItem={({ item }) => <OrderCard order={item} />}
      itemHeight={200}
    />
  );
}
```

### **Example 2: Performance Optimization**
```tsx
// BEFORE: Inefficient data fetching
const { data: ordersData } = useQuery({
  queryKey: ['admin-orders'],
  queryFn: () => getOrders({ page: 1, pageSize: 20 }),
  refetchInterval: 30000, // BAD: Aggressive polling
});

// AFTER: Optimized data fetching
const { data: ordersData } = useQuery({
  queryKey: ['admin-orders', filters],
  queryFn: () => getOrders({
    select: 'id,order_number,status,customer_name,total_amount,payment_status,created_at',
    ...filters
  }),
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
});
```

### **Example 3: State Management**
```tsx
// BEFORE: Complex useState hooks
const [searchQuery, setSearchQuery] = useState('');
const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilterType>('all');
const [currentPage, setCurrentPage] = useState(1);
const [activeTab, setActiveTab] = useState('all');
// ... 10+ more useState hooks

// AFTER: Centralized state with reducer
const [state, dispatch] = useOrdersReducer();

function useOrdersReducer() {
  return useReducer(ordersReducer, initialState);
}

const ordersReducer = (state: OrdersState, action: OrdersAction): OrdersState => {
  switch (action.type) {
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    case 'SET_PAGINATION':
      return { ...state, pagination: action.payload };
    default:
      return state;
  }
};
```

## 🔍 **VALIDATION REQUIREMENTS**

### **Testing Requirements**
```typescript
// Each new component must have:
1. Unit tests for all business logic functions
2. Integration tests for data fetching hooks
3. Accessibility tests for UI components
4. Performance tests for rendering speed

// Example test structure:
describe('OrderService', () => {
  describe('sortOrdersByPriority', () => {
    it('should prioritize today orders first', () => {
      // Test implementation
    });
  });
});
```

### **Performance Benchmarks**
```
REQUIREMENTS AFTER REFACTORING:
- Initial load time: < 2 seconds
- Filter response time: < 100ms
- Memory usage: < 50MB for 500 orders
- Bundle size increase: < 10KB
- Lighthouse Performance Score: > 90
```

### **Code Quality Standards**
```
REQUIREMENTS:
- No component > 200 lines
- No function > 50 lines
- Cyclomatic complexity < 10
- TypeScript strict mode enabled
- 0 ESLint errors
- Test coverage > 80%
```

## ⚠️ **IMPORTANT CONSTRAINTS**

1. **MAINTAIN EXISTING FUNCTIONALITY**: All current features must work exactly as before
2. **NO BREAKING CHANGES**: Existing APIs and user workflows must remain unchanged
3. **GRADUAL MIGRATION**: Changes should be incremental and testable
4. **BACKWARD COMPATIBILITY**: Support existing order data structures
5. **PERFORMANCE BUDGET**: No degradation in current performance metrics

## 🚀 **IMPLEMENTATION ORDER**

1. **Week 1**: Break down monolithic component (Phase 1, Task 1-3)
2. **Week 2**: Implement state management and extract business logic (Phase 2, Task 4-5)
3. **Week 3**: Optimize data fetching and add monitoring (Phase 3, Task 6-7)

## 📋 **SUCCESS CRITERIA**

- [ ] AdminOrders.tsx reduced from 1,169 lines to <200 lines
- [ ] All components are <200 lines each
- [ ] Performance improved by at least 50%
- [ ] Zero functionality regressions
- [ ] All tests passing
- [ ] Code quality metrics met
- [ ] User experience maintained or improved

---

**This prompt provides Loveable AI with specific, actionable tasks to systematically refactor the admin orders system while maintaining functionality and improving performance.**