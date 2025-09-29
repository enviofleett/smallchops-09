# NewOrderDetailsModal Defensive Data Testing Guide

## Test Scenarios for Defensive Validation

### 1. Null/Undefined Order Data

```typescript
// Test Case: No order provided
const testProps = {
  open: true,
  onClose: () => {},
  order: null
};
// Expected: Error modal with "No order data provided"
```

### 2. Malformed Order Data

```typescript
// Test Case: Invalid order structure
const testProps = {
  open: true,
  onClose: () => {},
  order: {
    id: null,
    order_number: undefined,
    status: "invalid_status",
    items: "not_an_array"
  }
};
// Expected: Validation error modal with data structure info
```

### 3. Missing Critical Fields

```typescript
// Test Case: Incomplete order data
const testProps = {
  open: true,
  onClose: () => {},
  order: {
    id: "123",
    // Missing order_number, status, customer info
  }
};
// Expected: Component renders with defensive fallbacks
```

### 4. Invalid Financial Data

```typescript
// Test Case: Corrupted financial fields
const testProps = {
  open: true,
  onClose: () => {},
  order: {
    id: "123",
    order_number: "ORD-123",
    total_amount: "invalid_number",
    items: [{
      quantity: null,
      unit_price: undefined,
      total_price: "not_a_number"
    }]
  }
};
// Expected: ₦0 displays, quantities default to 1
```

### 5. Malformed Items Array

```typescript
// Test Case: Invalid items structure
const testProps = {
  open: true,
  onClose: () => {},
  order: {
    id: "123",
    order_number: "ORD-123",
    items: [
      null,
      undefined,
      { /* missing required fields */ },
      "invalid_item"
    ]
  }
};
// Expected: Empty items display or filtered valid items only
```

### 6. Address Data Corruption

```typescript
// Test Case: Various address formats
const testCases = [
  { delivery_address: null },
  { delivery_address: "{invalid_json}" },
  { delivery_address: '{"address_line_1": "123 Main St"}' },
  { delivery_address: "Simple string address" },
  { delivery_address: { nested: { address: "Deep nested" } } }
];
// Expected: Safe address display or "Address not provided"
```

### 7. Date Corruption

```typescript
// Test Case: Invalid date values
const testProps = {
  open: true,
  onClose: () => {},
  order: {
    id: "123",
    created_at: "invalid_date",
    updated_at: null,
    order_time: 12345 // number instead of string
  }
};
// Expected: "Invalid date format" or fallback messages
```

## Defensive Function Tests

### formatCurrency Function

```javascript
// Test defensive currency formatting
console.log(formatCurrency(null));        // "₦0"
console.log(formatCurrency(undefined));   // "₦0" 
console.log(formatCurrency(NaN));         // "₦0"
console.log(formatCurrency("invalid"));   // "₦0"
console.log(formatCurrency(1500));        // "₦1,500"
```

### extractSafeOrderItems Function

```javascript
// Test multi-source item extraction
const result = extractSafeOrderItems(
  { items: null },                    // rawOrderData
  { items: undefined },               // detailedOrderData
  { order_items: "invalid" }          // order
);
// Expected: [] (empty array)
```

### logOrderDataIssue Function

```javascript
// Test production-safe logging
logOrderDataIssue("Test context", {
  id: "123",
  sensitive_data: "should_not_log",
  items: [1, 2, 3]
});
// Expected: Sanitized log with structure info only
```

## Integration Test Scenarios

### 1. Network Failure Recovery
- Real-time data fails to load
- Component falls back to props data
- Shows "Props only" in metadata

### 2. Partial Data Loading
- Real-time data partially loads
- Missing fields handled gracefully
- Mixed data sources indicated

### 3. Data Source Priority
- Multiple data sources available
- Correct priority order applied
- Best available data displayed

## Expected Defensive Behaviors

| Input | Expected Output | Fallback Level |
|-------|----------------|----------------|
| `null` order | Error modal | Component level |
| Invalid schema | Validation error | Schema level |
| Missing fields | Default values | Field level |
| Invalid numbers | 0 or defaults | Type level |
| Corrupted arrays | Empty arrays | Collection level |
| Bad dates | "Invalid date" | Format level |

## Manual Testing Checklist

- [ ] Component loads without errors with null data
- [ ] All financial fields show ₦0 for invalid numbers
- [ ] Customer info shows "Not provided" for missing data
- [ ] Order items gracefully handle empty/invalid arrays
- [ ] Address displays "Address not provided" for bad data
- [ ] Dates show fallback messages for invalid formats
- [ ] Error boundaries catch and display user-friendly messages
- [ ] Debug information appears in console for invalid data
- [ ] Real-time connection status updates properly
- [ ] Admin/customer views work with corrupted data

This comprehensive testing approach ensures the defensive validation strategies work correctly under all failure conditions.