# Notification System Documentation

A comprehensive notification system with sound, floating previews, and production-ready features.

## Features

- 🔔 **Bell Icon** - Interactive notification bell in header with unread count badge
- 📱 **Floating Preview** - Animated preview bar with progress timer
- 🔊 **Sound System** - Different notification sounds per type using Web Audio API
- 📱 **Mobile-Responsive** - Works seamlessly on all device sizes
- ⚡ **Real-time Updates** - Global event system for real-world integration
- ♿ **Accessible** - Screen reader friendly with proper ARIA labels
- 🎨 **Customizable** - Easy styling and theming

## Quick Usage

### 1. Basic Notification
```typescript
import { useNotifications } from '@/context/NotificationContext';

const { addNotification } = useNotifications();

addNotification({
  type: 'success',
  title: 'Order Confirmed!',
  message: 'Your order has been successfully placed.',
  sound: true,
  action: {
    label: 'View Order',
    onClick: () => navigate('/orders/123'),
  },
});
```

### 2. Real-world Integration
```typescript
import { triggerOrderUpdate } from '@/components/notifications/NotificationIntegration';

// Trigger from anywhere in your app
triggerOrderUpdate('12345', 'delivered', 'Your order has been delivered successfully!');
```

### 3. Using Demo Hook
```typescript
import { useNotificationDemo } from '@/hooks/useNotificationDemo';

const { showOrderStatusUpdate } = useNotificationDemo();

// Show order update notification
showOrderStatusUpdate('12345', 'confirmed');
```

## Notification Types

| Type | Icon | Sound | Use Case |
|------|------|-------|----------|
| `success` | ✅ | Pleasant chime | Order confirmations, payments |
| `error` | ❌ | Alert tone | Payment failures, errors |
| `warning` | ⚠️ | Warning beep | Cart expiring, low stock |
| `info` | ℹ️ | Soft chime | Promotions, updates |
| `order` | 📦 | Multi-tone | Order status updates |

## Sound Control

```typescript
import { useNotificationSound } from '@/hooks/useNotificationSound';

const { playSound, playTestSound } = useNotificationSound({
  enabled: true,  // Enable/disable sounds
  volume: 0.5     // Volume control (0-1)
});

// Play specific sound
playSound('success');

// Test sound
playTestSound('order');
```

## Global Events

The system listens for these custom events:

```typescript
// Order updates
window.dispatchEvent(new CustomEvent('order:updated', {
  detail: { orderNumber: '12345', status: 'delivered', message: 'Custom message' }
}));

// Payment success
window.dispatchEvent(new CustomEvent('payment:success', {
  detail: { orderNumber: '12345', amount: 2500 }
}));

// Payment errors
window.dispatchEvent(new CustomEvent('payment:error', {
  detail: { error: 'Payment failed', orderNumber: '12345' }
}));

// Promotions
window.dispatchEvent(new CustomEvent('promotion:available', {
  detail: { title: 'Weekend Special!', message: '25% off all items' }
}));

// Cart reminders
window.dispatchEvent(new CustomEvent('cart:reminder', {
  detail: { itemCount: 3 }
}));
```

## Configuration Options

### Notification Properties

```typescript
interface Notification {
  id: string;                    // Auto-generated
  type: NotificationType;        // success | error | warning | info | order
  title: string;                 // Required: Main notification title
  message?: string;              // Optional: Additional details
  timestamp: Date;               // Auto-generated
  read: boolean;                 // Auto-managed
  action?: {                     // Optional: Action button
    label: string;
    onClick: () => void;
  };
  autoClose?: boolean;           // Default: true
  duration?: number;             // Default: 5000ms for preview, 10000ms for removal
  sound?: boolean;               // Default: false
}
```

### Context API

```typescript
const {
  state,                 // Current notification state
  addNotification,       // Add new notification
  removeNotification,    // Remove by ID
  markAsRead,           // Mark single as read
  markAllAsRead,        // Mark all as read
  clearAll,             // Clear all notifications
  showPreview,          // Show preview manually
  hidePreview,          // Hide preview manually
} = useNotifications();
```

## Integration Examples

### E-commerce Order Flow
```typescript
// When order is placed
addNotification({
  type: 'success',
  title: 'Order Placed Successfully!',
  message: 'Order #12345 has been confirmed and is being processed.',
  sound: true,
  action: {
    label: 'Track Order',
    onClick: () => navigate('/track/12345'),
  },
});

// When order is ready
triggerOrderUpdate('12345', 'ready', 'Your order is ready for pickup!');
```

### Payment Processing
```typescript
// Payment success
triggerPaymentSuccess('12345', 2500);

// Payment failure
triggerPaymentError('Insufficient funds. Please try another payment method.');
```

### Marketing & Engagement
```typescript
// Promotional notifications
triggerPromotion('🎉 Weekend Special!', 'Get 25% off on all items this weekend!');

// Cart abandonment
triggerCartReminder(3); // 3 items in cart
```

## Styling & Theming

The notification system uses semantic CSS classes that follow your design system:

```css
/* Notification bell badge */
.notification-badge {
  @apply bg-primary text-primary-foreground;
}

/* Notification preview colors */
.notification-success {
  @apply bg-green-50 border-green-200 text-green-900;
}

.notification-error {
  @apply bg-red-50 border-red-200 text-red-900;
}

/* Custom animations */
.notification-enter {
  @apply animate-slide-in-right;
}

.notification-exit {
  @apply animate-slide-out-right;
}
```

## Production Considerations

1. **Performance** - Notifications auto-cleanup after expiry
2. **Accessibility** - Screen reader announcements for important notifications
3. **Mobile** - Touch-friendly with proper spacing
4. **Sound** - Respects user preferences and page focus
5. **Persistence** - Notifications persist during page navigation
6. **Rate Limiting** - Prevents notification spam

## Testing

Use the demo button (development only):

```typescript
import { NotificationDemoButton } from '@/components/notifications/NotificationDemoButton';

// Add temporarily to any page for testing
<NotificationDemoButton />
```

## Browser Support

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Web Audio API for sounds (with graceful fallback)
- ✅ CSS animations and transitions
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Sounds not playing?
- Check browser autoplay policies (user interaction required)
- Ensure page has focus when sound plays
- Verify Web Audio API support

### Notifications not showing?
- Ensure NotificationProvider wraps your app
- Check context usage within provider scope
- Verify component imports are correct

### Performance issues?
- Check notification cleanup settings
- Monitor notification state size
- Consider debouncing rapid notifications