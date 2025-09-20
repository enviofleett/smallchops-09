import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdminError {
  id: string;
  orderId: string;
  error: string;
  timestamp: number;
  retryCount: number;
  errorType: 'network' | 'conflict' | 'timeout' | 'auth' | 'server' | 'unknown';
  adminUserId: string;
  context?: string;
  resolved?: boolean;
}

export interface ErrorPattern {
  type: string;
  count: number;
  lastOccurrence: number;
  affectedOrders: string[];
}

interface AdminErrorState {
  errors: AdminError[];
  persistentErrors: Map<string, AdminError>;
  errorPatterns: Map<string, ErrorPattern>;
  isRecoveryMode: boolean;
  
  // Actions
  addError: (error: Omit<AdminError, 'id' | 'timestamp'>) => string;
  resolveError: (errorId: string) => void;
  incrementRetryCount: (errorId: string) => void;
  clearResolvedErrors: () => void;
  clearAllErrors: () => void;
  getErrorsForOrder: (orderId: string) => AdminError[];
  getUnresolvedErrors: () => AdminError[];
  enableRecoveryMode: () => void;
  disableRecoveryMode: () => void;
  detectPatterns: () => ErrorPattern[];
  shouldAutoRetry: (orderId: string, errorType: string) => boolean;
}

export const useAdminErrorStore = create<AdminErrorState>()(
  persist(
    (set, get) => ({
      errors: [],
      persistentErrors: new Map(),
      errorPatterns: new Map(),
      isRecoveryMode: false,

      addError: (errorData) => {
        const errorId = `${errorData.orderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newError: AdminError = {
          ...errorData,
          id: errorId,
          timestamp: Date.now(),
        };

        set((state) => {
          const updatedErrors = [...state.errors, newError];
          const updatedPersistentErrors = new Map(state.persistentErrors);
          
          // Store persistent errors (unresolved conflicts and auth errors)
          if (['conflict', 'auth'].includes(newError.errorType)) {
            updatedPersistentErrors.set(errorId, newError);
          }

          // Update error patterns
          const updatedPatterns = new Map(state.errorPatterns);
          const patternKey = `${newError.errorType}_${newError.orderId}`;
          const existingPattern = updatedPatterns.get(patternKey);
          
          if (existingPattern) {
            const updatedPattern: ErrorPattern = {
              ...existingPattern,
              count: existingPattern.count + 1,
              lastOccurrence: newError.timestamp,
              affectedOrders: existingPattern.affectedOrders.includes(newError.orderId) 
                ? existingPattern.affectedOrders 
                : [...existingPattern.affectedOrders, newError.orderId]
            };
            updatedPatterns.set(patternKey, updatedPattern);
          } else {
            updatedPatterns.set(patternKey, {
              type: newError.errorType,
              count: 1,
              lastOccurrence: newError.timestamp,
              affectedOrders: [newError.orderId]
            });
          }

          return {
            ...state,
            errors: updatedErrors,
            persistentErrors: updatedPersistentErrors,
            errorPatterns: updatedPatterns
          };
        });

        return errorId;
      },

      resolveError: (errorId) => {
        set((state) => ({
          ...state,
          errors: state.errors.map(error => 
            error.id === errorId ? { ...error, resolved: true } : error
          ),
          persistentErrors: (() => {
            const updated = new Map(state.persistentErrors);
            updated.delete(errorId);
            return updated;
          })()
        }));
      },

      incrementRetryCount: (errorId) => {
        set((state) => ({
          ...state,
          errors: state.errors.map(error => 
            error.id === errorId ? { ...error, retryCount: error.retryCount + 1 } : error
          )
        }));
      },

      clearResolvedErrors: () => {
        set((state) => ({
          ...state,
          errors: state.errors.filter(error => !error.resolved)
        }));
      },

      clearAllErrors: () => {
        set({
          errors: [],
          persistentErrors: new Map(),
          errorPatterns: new Map(),
          isRecoveryMode: false
        });
      },

      getErrorsForOrder: (orderId) => {
        return get().errors.filter(error => error.orderId === orderId);
      },

      getUnresolvedErrors: () => {
        return get().errors.filter(error => !error.resolved);
      },

      enableRecoveryMode: () => {
        set({ isRecoveryMode: true });
      },

      disableRecoveryMode: () => {
        set({ isRecoveryMode: false });
      },

      detectPatterns: () => {
        const patterns = Array.from(get().errorPatterns.values());
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        // Filter recent patterns
        return patterns.filter(pattern => 
          now - pattern.lastOccurrence < oneHour && pattern.count >= 3
        );
      },

      shouldAutoRetry: (orderId, errorType) => {
        const errors = get().getErrorsForOrder(orderId);
        const recentErrors = errors.filter(error => 
          Date.now() - error.timestamp < 5 * 60 * 1000 // 5 minutes
        );

        // Don't auto-retry if there have been too many recent failures
        if (recentErrors.length >= 3) return false;

        // Auto-retry network errors and timeouts
        return ['network', 'timeout'].includes(errorType);
      }
    }),
    {
      name: 'admin-error-store',
      partialize: (state) => ({
        persistentErrors: Array.from(state.persistentErrors.entries()),
        errorPatterns: Array.from(state.errorPatterns.entries()),
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.persistentErrors) {
          // Convert arrays back to Maps
          state.persistentErrors = new Map(state.persistentErrors as any);
          state.errorPatterns = new Map(state.errorPatterns as any);
        }
      }
    }
  )
);