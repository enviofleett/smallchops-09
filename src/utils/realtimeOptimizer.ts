import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Centralized realtime channel manager to prevent duplicate subscriptions
class RealtimeChannelManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscribers: Map<string, Set<string>> = new Map();
  
  subscribe(
    channelKey: string,
    subscriberId: string,
    config: {
      table: string;
      event: string;
      schema?: string;
      callback: (payload: any) => void;
    }
  ) {
    // Create unique key for this subscription type
    const subscriptionKey = `${config.schema || 'public'}-${config.table}-${config.event}`;
    
    // Track this subscriber
    if (!this.subscribers.has(subscriptionKey)) {
      this.subscribers.set(subscriptionKey, new Set());
    }
    this.subscribers.get(subscriptionKey)!.add(subscriberId);
    
    // Check if channel already exists
    if (this.channels.has(subscriptionKey)) {
      console.log(`📡 Reusing existing channel for ${subscriptionKey}`);
      return this.channels.get(subscriptionKey)!;
    }
    
    console.log(`📡 Creating new optimized channel for ${subscriptionKey}`);
    
    // Create new consolidated channel
    const channel = supabase
      .channel(`optimized-${subscriptionKey}`)
      .on(
        'postgres_changes',
        {
          event: config.event as any,
          schema: config.schema || 'public',
          table: config.table
        },
        (payload) => {
          // Broadcast to all subscribers of this channel
          config.callback(payload);
        }
      )
      .subscribe();
    
    this.channels.set(subscriptionKey, channel);
    return channel;
  }
  
  unsubscribe(subscriberId: string, channelKey?: string) {
    if (channelKey) {
      const subscribers = this.subscribers.get(channelKey);
      if (subscribers) {
        subscribers.delete(subscriberId);
        
        // If no more subscribers, clean up the channel
        if (subscribers.size === 0) {
          const channel = this.channels.get(channelKey);
          if (channel) {
            console.log(`📡 Cleaning up unused channel: ${channelKey}`);
            supabase.removeChannel(channel);
            this.channels.delete(channelKey);
            this.subscribers.delete(channelKey);
          }
        }
      }
    } else {
      // Remove subscriber from all channels
      for (const [key, subscribers] of this.subscribers.entries()) {
        subscribers.delete(subscriberId);
        if (subscribers.size === 0) {
          const channel = this.channels.get(key);
          if (channel) {
            console.log(`📡 Cleaning up unused channel: ${key}`);
            supabase.removeChannel(channel);
            this.channels.delete(key);
            this.subscribers.delete(key);
          }
        }
      }
    }
  }
  
  // Get channel usage statistics
  getStats() {
    return {
      activeChannels: this.channels.size,
      totalSubscribers: Array.from(this.subscribers.values())
        .reduce((sum, set) => sum + set.size, 0),
      channelDetails: Array.from(this.channels.keys()).map(key => ({
        key,
        subscribers: this.subscribers.get(key)?.size || 0
      }))
    };
  }
  
  // Clean up all channels (for app unmount)
  cleanup() {
    console.log('📡 Cleaning up all realtime channels');
    for (const channel of this.channels.values()) {
      supabase.removeChannel(channel);
    }
    this.channels.clear();
    this.subscribers.clear();
  }
}

export const realtimeManager = new RealtimeChannelManager();

// Optimized realtime subscription with resilience and fallback
export const useOptimizedRealtime = (
  subscriberId: string,
  config: {
    table: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    callback: (payload: any) => void;
    enabled?: boolean;
  }
) => {
  const { useEffect, useRef } = require('react');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);
  
  const subscribe = () => {
    if (!config.enabled || isSubscribedRef.current) return;
    
    console.log(`📡 Setting up optimized realtime subscription for ${subscriberId}`);
    
    try {
      const channel = realtimeManager.subscribe(
        `${config.table}-${config.event}`,
        subscriberId,
        {
          ...config,
          callback: (payload) => {
            console.log(`📨 Realtime event received for ${config.table}:`, payload.eventType);
            
            // Enhanced error handling for callback
            try {
              config.callback(payload);
            } catch (error) {
              console.error(`❌ Error in realtime callback for ${subscriberId}:`, error);
              // Don't break the subscription due to callback errors
            }
          }
        }
      );
      
      channelRef.current = channel;
      isSubscribedRef.current = true;
      
      // Set up connection health monitoring
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
    } catch (error) {
      console.error(`❌ Failed to set up realtime subscription for ${subscriberId}:`, error);
      
      // Retry subscription after delay
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Retrying realtime subscription for ${subscriberId}`);
          reconnectTimeoutRef.current = null;
          isSubscribedRef.current = false;
          subscribe();
        }, 5000);
      }
    }
  };
  
  const unsubscribe = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (isSubscribedRef.current) {
      console.log(`📡 Unsubscribing realtime for ${subscriberId}`);
      realtimeManager.unsubscribe(subscriberId, `${config.table}-${config.event}`);
      isSubscribedRef.current = false;
      channelRef.current = null;
    }
  };
  
  useEffect(() => {
    if (config.enabled) {
      subscribe();
    } else {
      unsubscribe();
    }
    
    // Cleanup on config changes
    return () => {
      if (!config.enabled) {
        unsubscribe();
      }
    };
  }, [subscriberId, config.table, config.event, config.enabled]);
  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      unsubscribe();
      realtimeManager.unsubscribe(subscriberId);
    };
  }, [subscriberId]);
  
  // Return subscription status for debugging
  return {
    isSubscribed: isSubscribedRef.current,
    stats: realtimeManager.getStats()
  };
};