interface QueuedRequest {
  id: string;
  operation: () => Promise<any>;
  retries: number;
  maxRetries: number;
  timestamp: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private maxQueueSize = 50;

  add(operation: () => Promise<any>, maxRetries: number = 3): string {
    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Don't queue if we're at capacity
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Request queue is full, dropping oldest request');
      this.queue.shift();
    }
    
    this.queue.push({
      id,
      operation,
      retries: 0,
      maxRetries,
      timestamp: Date.now()
    });
    
    console.log(`📤 Queued request ${id} (${this.queue.length} in queue)`);
    this.processQueue();
    
    return id;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      // Check if we're online before processing
      if (!navigator.onLine) {
        console.log('📴 Offline - pausing queue processing');
        break;
      }

      const request = this.queue.shift()!;
      
      try {
        console.log(`🔄 Processing queued request ${request.id}`);
        await request.operation();
        console.log(`✅ Successfully processed request ${request.id}`);
      } catch (error) {
        console.error(`❌ Failed to process request ${request.id}:`, error);
        
        // Retry if we haven't exceeded max retries
        if (request.retries < request.maxRetries) {
          request.retries++;
          this.queue.unshift(request); // Put back at front of queue
          console.log(`🔄 Retrying request ${request.id} (attempt ${request.retries}/${request.maxRetries})`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * request.retries));
        } else {
          console.error(`💀 Request ${request.id} failed after ${request.maxRetries} attempts`);
        }
      }
      
      // Small delay between requests to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessing = false;
  }

  // Resume processing when connection is restored
  resume() {
    console.log('🟢 Connection restored - resuming queue processing');
    this.processQueue();
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    };
  }

  // Clear old requests (older than 1 hour)
  cleanup() {
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(req => req.timestamp > cutoff);
    
    if (this.queue.length < initialLength) {
      console.log(`🧹 Cleaned up ${initialLength - this.queue.length} old requests from queue`);
    }
  }
}

export const requestQueue = new RequestQueue();

// Set up connection monitoring
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    requestQueue.resume();
  });
  
  // Cleanup old requests every 10 minutes
  setInterval(() => {
    requestQueue.cleanup();
  }, 10 * 60 * 1000);
}