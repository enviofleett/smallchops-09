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

// Optimized useRealtimeSubscription hook
export const useOptimizedRealtime = (
  subscriberId: string,
  config: {
    table: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    callback: (payload: any) => void;
    enabled?: boolean;
  }
) => {
  const { useEffect } = require('react');
  
  useEffect(() => {
    if (!config.enabled) return;
    
    const channel = realtimeManager.subscribe(
      `${config.table}-${config.event}`,
      subscriberId,
      config
    );
    
    return () => {
      realtimeManager.unsubscribe(subscriberId, `${config.table}-${config.event}`);
    };
  }, [subscriberId, config.table, config.event, config.enabled]);
  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      realtimeManager.unsubscribe(subscriberId);
    };
  }, [subscriberId]);
};