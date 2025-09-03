// Global component error handler to prevent ComponentLoadError from crashing the app
import { ComponentType, createElement } from 'react';

// Enhanced error recovery system
export class ComponentErrorHandler {
  private static failedComponents = new Set<string>();
  private static retryAttempts = new Map<string, number>();
  private static maxGlobalRetries = 2;

  static handleComponentError(componentName: string, error: Error): ComponentType | null {
    console.error(`🚨 Component "${componentName}" failed to load:`, error);
    
    // Track failed components
    this.failedComponents.add(componentName);
    
    // Update retry count
    const currentRetries = this.retryAttempts.get(componentName) || 0;
    this.retryAttempts.set(componentName, currentRetries + 1);

    // If we've exceeded max retries, return null to trigger error boundary
    if (currentRetries >= this.maxGlobalRetries) {
      console.error(`🚨 Component "${componentName}" exceeded max retry attempts`);
      return null;
    }

    // Return a simple error component instead of crashing
    return () => {
      return createElement('div', {
        className: "flex flex-col items-center justify-center min-h-[200px] p-4 space-y-4 border border-destructive/20 rounded-lg bg-destructive/5"
      }, [
        createElement('div', {
          className: "text-destructive text-center",
          key: "content"
        }, [
          createElement('h3', {
            className: "text-lg font-semibold mb-2",
            key: "title"
          }, "Component Loading Failed"),
          createElement('p', {
            className: "text-sm text-muted-foreground mb-4",
            key: "message"
          }, "Please refresh your page")
        ]),
        createElement('button', {
          onClick: () => window.location.reload(),
          className: "px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors",
          key: "button"
        }, "Refresh Page")
      ]);
    };
  }

  static clearFailedComponents() {
    this.failedComponents.clear();
    this.retryAttempts.clear();
  }

  static getFailedComponents() {
    return Array.from(this.failedComponents);
  }
}

// Global error event listener for unhandled component errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'ComponentLoadError') {
    console.error('🚨 Unhandled ComponentLoadError:', event.reason);
    event.preventDefault(); // Prevent the error from crashing the app
    
    // Show a simple user-friendly message
    const notification = document.createElement('div');
    notification.innerHTML = 
      '<div style="position: fixed; top: 20px; right: 20px; background: white; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 10000; max-width: 300px; font-family: system-ui, -apple-system, sans-serif;">' +
        '<div style="color: #ef4444; font-weight: bold; margin-bottom: 8px;">Component Loading Failed</div>' +
        '<div style="color: #6b7280; font-size: 14px; margin-bottom: 12px;">Please refresh your page</div>' +
        '<button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">Refresh Page</button>' +
        '<button onclick="this.parentElement.remove()" style="background: none; color: #6b7280; border: none; padding: 8px 16px; cursor: pointer; font-size: 14px; margin-left: 8px;">Dismiss</button>' +
      '</div>';
    
    document.body.appendChild(notification);
    
    // Auto-remove notification after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }
});

export default ComponentErrorHandler;