// Optimized interval management to reduce resource usage
export class IntervalOptimizer {
  private static intervals: Map<string, {
    intervalId: NodeJS.Timeout;
    callback: () => void;
    intervalMs: number;
    isVisible: boolean;
  }> = new Map();
  
  private static visibilityHandler = () => {
    const isVisible = !document.hidden;
    
    for (const [key, interval] of IntervalOptimizer.intervals) {
      if (isVisible && !interval.isVisible) {
        // Resume interval when tab becomes visible
        interval.isVisible = true;
        clearInterval(interval.intervalId);
        interval.intervalId = setInterval(interval.callback, interval.intervalMs);
      } else if (!isVisible && interval.isVisible) {
        // Pause interval when tab becomes hidden
        interval.isVisible = false;
        clearInterval(interval.intervalId);
      }
    }
  };
  
  static {
    // Set up global visibility handler
    document.addEventListener('visibilitychange', IntervalOptimizer.visibilityHandler);
  }
  
  static createOptimizedInterval(
    key: string,
    callback: () => void,
    intervalMs: number,
    options: {
      pauseWhenHidden?: boolean;
      immediate?: boolean;
    } = { pauseWhenHidden: true, immediate: false }
  ) {
    // Clear existing interval with same key
    this.clearInterval(key);
    
    // Execute immediately if requested
    if (options.immediate) {
      callback();
    }
    
    const isVisible = !document.hidden;
    const shouldStart = !options.pauseWhenHidden || isVisible;
    
    const intervalId = shouldStart 
      ? setInterval(callback, intervalMs)
      : setTimeout(() => {}, 0) as any; // Placeholder timeout
    
    this.intervals.set(key, {
      intervalId,
      callback,
      intervalMs,
      isVisible: shouldStart
    });
    
    return key;
  }
  
  static clearInterval(key: string) {
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval.intervalId);
      this.intervals.delete(key);
    }
  }
  
  static clearAllIntervals() {
    for (const interval of this.intervals.values()) {
      clearInterval(interval.intervalId);
    }
    this.intervals.clear();
  }
  
  static getActiveIntervals() {
    return Array.from(this.intervals.keys());
  }
  
  static getStats() {
    return {
      total: this.intervals.size,
      active: Array.from(this.intervals.values()).filter(i => i.isVisible).length,
      paused: Array.from(this.intervals.values()).filter(i => !i.isVisible).length,
    };
  }
}

// Optimized useInterval hook
export const useOptimizedInterval = (
  callback: () => void,
  delay: number | null,
  options: {
    pauseWhenHidden?: boolean;
    immediate?: boolean;
    key?: string;
  } = {}
) => {
  const { useEffect, useRef } = require('react');
  const callbackRef = useRef(callback);
  const keyRef = useRef(options.key || `interval-${Math.random()}`);
  
  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (delay === null) return;
    
    const key = IntervalOptimizer.createOptimizedInterval(
      keyRef.current,
      () => callbackRef.current(),
      delay,
      {
        pauseWhenHidden: options.pauseWhenHidden ?? true,
        immediate: options.immediate ?? false,
      }
    );
    
    return () => {
      IntervalOptimizer.clearInterval(key);
    };
  }, [delay, options.pauseWhenHidden, options.immediate]);
};