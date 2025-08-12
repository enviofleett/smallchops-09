import { supabase } from '@/integrations/supabase/client';
import { realtimeManager } from './realtimeOptimizer';
import { IntervalOptimizer } from './intervalOptimizer';

// Central usage optimizer and monitoring
export class UsageOptimizer {
  private static metrics = {
    databaseQueries: 0,
    realtimeMessages: 0,
    edgeFunctionCalls: 0,
    storageOperations: 0,
  };
  
  private static optimizations = {
    batchSize: 10,           // Batch operations when possible
    cacheThreshold: 100,     // Cache responses after this many calls
    rateLimitBuffer: 0.8,    // Stay at 80% of rate limits
  };
  
  // Track usage for monitoring
  static trackDatabaseQuery(operation: string) {
    this.metrics.databaseQueries++;
    if (this.metrics.databaseQueries % 100 === 0) {
      console.log(`📊 Database queries: ${this.metrics.databaseQueries}`);
    }
  }
  
  static trackRealtimeMessage() {
    this.metrics.realtimeMessages++;
  }
  
  static trackEdgeFunctionCall(functionName: string) {
    this.metrics.edgeFunctionCalls++;
    if (this.metrics.edgeFunctionCalls % 50 === 0) {
      console.log(`⚡ Edge function calls: ${this.metrics.edgeFunctionCalls}`);
    }
  }
  
  // Get current usage statistics
  static getUsageStats() {
    const realtimeStats = realtimeManager.getStats();
    const intervalStats = IntervalOptimizer.getStats();
    
    return {
      database: this.metrics.databaseQueries,
      realtime: {
        messages: this.metrics.realtimeMessages,
        channels: realtimeStats.activeChannels,
        subscribers: realtimeStats.totalSubscribers,
      },
      edgeFunctions: this.metrics.edgeFunctionCalls,
      intervals: intervalStats,
      recommendations: this.generateRecommendations(),
    };
  }
  
  private static generateRecommendations() {
    const recommendations: string[] = [];
    
    if (this.metrics.databaseQueries > 1000) {
      recommendations.push('Consider implementing more aggressive caching for database queries');
    }
    
    if (realtimeManager.getStats().activeChannels > 5) {
      recommendations.push('Multiple realtime channels detected - consider consolidation');
    }
    
    if (this.metrics.edgeFunctionCalls > 500) {
      recommendations.push('High edge function usage - consider client-side optimization');
    }
    
    return recommendations;
  }
  
  // Create optimized supabase client wrapper
  static createOptimizedClient() {
    const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
    
    return {
      // Note: TypeScript-safe wrapper would require more complex typing
      // For now, we'll use the original client with tracking
      from: (table: any) => {
        this.trackDatabaseQuery(`SELECT ${table}`);
        return supabase.from(table);
      },
      
      functions: {
        invoke: (name: string, options?: any) => {
          this.trackEdgeFunctionCall(name);
          return supabase.functions.invoke(name, options);
        },
      },
    };
  }
  
  // Cleanup resources to reduce usage
  static cleanup() {
    console.log('🧹 Cleaning up resources to reduce usage');
    
    // Clear realtime channels
    realtimeManager.cleanup();
    
    // Clear all intervals
    IntervalOptimizer.clearAllIntervals();
    
    // Reset metrics
    this.metrics = {
      databaseQueries: 0,
      realtimeMessages: 0,
      edgeFunctionCalls: 0,
      storageOperations: 0,
    };
  }
}

// Global cleanup on page unload
window.addEventListener('beforeunload', () => {
  UsageOptimizer.cleanup();
});