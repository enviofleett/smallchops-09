# Network Error Handling & Resilience System

## Overview

This document describes the enhanced network error handling and resilience system implemented to resolve the "Network Error" issues on the dashboard. The system provides comprehensive error classification, user-friendly messaging, automatic retry logic, and graceful degradation.

## Key Components

### 1. Error Classification System (`src/utils/errorClassification.ts`)

**Purpose**: Automatically categorizes errors and provides appropriate user messaging and recovery actions.

**Features**:
- Classifies errors into types: `network`, `auth`, `server`, `client`, `timeout`, `permission`, `rate_limit`, `unknown`
- Provides user-friendly messages with actionable steps
- Generates unique error IDs for debugging
- Determines retry eligibility and strategies
- Implements exponential backoff with jitter

**Usage**:
```typescript
import { classifyError, logError, shouldRetry } from '@/utils/errorClassification';

try {
  // API call
} catch (error) {
  const classified = classifyError(error);
  logError(classified, { component: 'Dashboard' });
  
  if (shouldRetry(classified, attemptCount)) {
    // Retry with delay
    const delay = calculateRetryDelay(attemptCount);
    setTimeout(retry, delay);
  }
}
```

### 2. Circuit Breaker Pattern (`src/utils/circuitBreaker.ts`)

**Purpose**: Prevents cascading failures by temporarily blocking requests to failing services.

**States**:
- `CLOSED`: Normal operation
- `OPEN`: Service unavailable, reject requests  
- `HALF_OPEN`: Testing if service is restored

**Usage**:
```typescript
import { dashboardApiCircuitBreaker } from '@/utils/circuitBreaker';

const result = await dashboardApiCircuitBreaker.execute(async () => {
  return await apiCall();
});
```

### 3. Enhanced Network Provider (`src/components/network/NetworkProvider.tsx`)

**Features**:
- Online/offline status monitoring
- Connection quality detection (`poor`, `good`, `excellent`)
- API availability checking with health endpoints
- Network latency measurement
- Periodic health checks every 2 minutes

**Context Values**:
```typescript
interface NetworkContextType {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  connectionQuality: 'poor' | 'good' | 'excellent' | 'unknown';
  apiAvailable: boolean;
  lastApiCheck: Date | null;
  networkLatency: number | null;
  checkApiHealth: () => Promise<boolean>;
}
```

### 4. Enhanced Dashboard Hook (`src/hooks/useDashboardData.ts`)

**Improvements**:
- Uses error classification for better error handling
- Integrates with network monitoring
- Provides structured error objects instead of strings
- Implements fallback data for graceful degradation

**Error Object Structure**:
```typescript
interface DashboardError {
  message: string;
  type: 'network' | 'auth' | 'server' | 'client' | 'timeout' | 'permission' | 'rate_limit' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionable: boolean;
  retryable: boolean;
  suggestedActions: string[];
  errorId: string;
}
```

### 5. Enhanced Progressive Loader (`src/components/ui/progressive-loader.tsx`)

**Features**:
- Network-aware error display
- Different error icons based on error type
- Connection status indicators
- Detailed error messages with suggested actions
- Timeout handling with user feedback

### 6. Improved Online Status Banner (`src/components/network/OnlineStatusBanner.tsx`)

**Features**:
- Shows different states: offline, poor connection, API issues, restored
- Displays connection quality and latency information
- Provides context-specific messaging

### 7. Enhanced Error Boundary (`src/components/ErrorBoundaryWrapper.tsx`)

**Improvements**:
- Uses error classification system
- Network-aware error display
- Better retry logic based on error type
- Enhanced logging with error IDs

## Error Scenarios & Responses

### 1. Network Connectivity Issues
**Symptoms**: `ERR_NETWORK`, `fetch failed`, offline status
**Response**:
- Show "Connection problem detected" message
- Suggest checking internet connection
- Enable retry with exponential backoff
- Display offline indicator

### 2. Timeout Errors  
**Symptoms**: Request timeouts, slow responses
**Response**:
- Show "Request timed out" message
- Suggest checking connection speed
- Implement progressive timeout increases
- Show latency information when available

### 3. Authentication Errors
**Symptoms**: 401 status, "unauthorized" messages
**Response**:
- Show "Authentication required" message
- Suggest logging in again
- Do not retry automatically
- Provide login redirect

### 4. Permission Errors
**Symptoms**: 403 status, "forbidden" messages  
**Response**:
- Show "Access denied" message
- Suggest contacting administrator
- Do not retry automatically
- Provide contact information

### 5. Server Errors
**Symptoms**: 5xx status codes, server failures
**Response**:
- Show "Server error occurred" message
- Enable automatic retry with backoff
- Log error details for monitoring
- Show service status when available

### 6. Rate Limiting
**Symptoms**: 429 status, "too many requests"
**Response**:
- Show "Too many requests" message
- Implement longer retry delays
- Suggest waiting before retry
- Monitor request patterns

## Implementation Benefits

### 1. Improved User Experience
- Clear, actionable error messages instead of generic "Network Error"
- Visual indicators showing connection status and quality
- Appropriate retry options based on error type
- Graceful degradation with fallback data

### 2. Better Debugging
- Unique error IDs for tracking issues
- Comprehensive error logging with context
- Circuit breaker state monitoring
- Performance metrics (latency, retry counts)

### 3. Enhanced Reliability  
- Circuit breaker prevents cascading failures
- Intelligent retry logic with exponential backoff
- Automatic service health monitoring
- Fallback data prevents blank screens

### 4. Network Awareness
- Distinguishes between local connectivity and service issues
- Monitors connection quality and latency
- Provides appropriate messaging for different network conditions
- Adapts retry strategies based on network state

## Monitoring & Debugging

### Error IDs
Every error generates a unique ID format: `ERR_[timestamp]_[random]`
Example: `ERR_L8K9M2_A7F3G1`

### Console Logging
```javascript
// Development logging
console.group('🚨 NETWORK Error [ERR_L8K9M2_A7F3G1]');
console.error('Type: network');
console.error('Category: connectivity');  
console.error('Message: Connection timeout...');
console.groupEnd();

// Production logging (structured)
{
  errorId: 'ERR_L8K9M2_A7F3G1',
  type: 'network',
  severity: 'high',
  component: 'useDashboardData',
  timestamp: '2024-01-20T10:30:00.000Z'
}
```

### Circuit Breaker Monitoring
```javascript
// Check circuit breaker status
const stats = dashboardApiCircuitBreaker.getStats();
console.log('Circuit breaker state:', stats.state);
console.log('Failure count:', stats.failures);
console.log('Next attempt:', new Date(stats.nextAttempt));
```

## Testing Error Scenarios

### 1. Network Disconnection
- Disable network connection
- Verify offline banner appears
- Confirm appropriate error messages
- Test retry behavior when reconnected

### 2. API Service Unavailable
- Block API endpoints  
- Verify circuit breaker opens
- Check fallback data display
- Test service recovery detection

### 3. Slow Connection
- Throttle network to 2G speeds
- Verify timeout handling
- Check connection quality indicator
- Test progressive timeout increases

### 4. Authentication Failure
- Use invalid auth tokens
- Verify auth error detection
- Check no automatic retry
- Test login redirect flow

## Configuration

### Circuit Breaker Settings
```typescript
const dashboardApiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,     // Open after 3 failures
  recoveryTimeout: 30000,  // Wait 30s before retry
  successThreshold: 2      // Close after 2 successes
});
```

### Retry Configuration
```typescript
// Base delay: 1000ms
// Max delay: 30000ms  
// Jitter: ±10%
const delay = calculateRetryDelay(attemptCount);
```

### Health Check Intervals
- API health checks: Every 2 minutes
- Connection quality checks: On network change
- Circuit breaker state checks: Per request

## Future Enhancements

1. **Service Worker Integration**: Offline caching and background sync
2. **WebSocket Monitoring**: Real-time connection status
3. **Predictive Retry**: ML-based optimal retry timing
4. **User Preference Storage**: Remember user retry preferences
5. **Advanced Metrics**: Detailed performance analytics