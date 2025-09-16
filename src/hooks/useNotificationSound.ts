import { useCallback, useRef, useEffect } from 'react';
import { NotificationType } from '@/context/NotificationContext';
import { useUserContext } from './useUserContext';

interface NotificationSounds {
  success: string;
  error: string;
  warning: string;
  info: string;
  order: string;
}

// Create notification sounds using Web Audio API with user context differentiation
const createNotificationSound = (
  frequency: number, 
  duration: number, 
  type: 'sine' | 'square' | 'triangle' = 'sine',
  userContext: 'admin' | 'customer' | 'guest' = 'customer'
) => {
  return new Promise<void>((resolve) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Apply pitch adjustment based on user context
      const contextMultiplier = userContext === 'admin' ? 1.3 : userContext === 'customer' ? 1.0 : 0.8;
      const adjustedFrequency = frequency * contextMultiplier;
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(adjustedFrequency, audioContext.currentTime);

      // Create envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      oscillator.onended = () => {
        audioContext.close();
        resolve();
      };
    } catch (error) {
      console.warn('Audio API not supported:', error);
      resolve();
    }
  });
};

// Multi-tone sounds for different notification types with user context
const playSuccessSound = async (userContext: 'admin' | 'customer' | 'guest' = 'customer') => {
  await createNotificationSound(523, 0.2, 'triangle', userContext); // C5
  await createNotificationSound(659, 0.3, 'triangle', userContext); // E5
};

const playErrorSound = async (userContext: 'admin' | 'customer' | 'guest' = 'customer') => {
  await createNotificationSound(200, 0.1, 'square', userContext);
  await createNotificationSound(150, 0.2, 'square', userContext);
};

const playWarningSound = async (userContext: 'admin' | 'customer' | 'guest' = 'customer') => {
  await createNotificationSound(400, 0.15, 'sine', userContext);
  await createNotificationSound(450, 0.15, 'sine', userContext);
};

const playInfoSound = async (userContext: 'admin' | 'customer' | 'guest' = 'customer') => {
  await createNotificationSound(800, 0.1, 'sine', userContext);
  await createNotificationSound(600, 0.1, 'sine', userContext);
};

const playOrderSound = async (userContext: 'admin' | 'customer' | 'guest' = 'customer') => {
  await createNotificationSound(440, 0.1, 'triangle', userContext); // A4
  await createNotificationSound(554, 0.1, 'triangle', userContext); // C#5
  await createNotificationSound(659, 0.2, 'triangle', userContext); // E5
};

export interface UseNotificationSoundOptions {
  enabled?: boolean;
  volume?: number;
}

export const useNotificationSound = (options: UseNotificationSoundOptions = {}) => {
  const { enabled = true, volume = 0.5 } = options;
  const userContext = useUserContext();
  const isPlayingRef = useRef(false);
  const settingsRef = useRef({ enabled, volume });

  // Update settings ref when options change
  useEffect(() => {
    settingsRef.current = { enabled, volume };
  }, [enabled, volume]);

  const playSound = useCallback(async (type: NotificationType) => {
    // Prevent overlapping sounds
    if (isPlayingRef.current || !settingsRef.current.enabled) return;
    
    // Check if user has interacted with the page (required for audio)
    if (typeof window !== 'undefined' && !document.hasFocus?.()) {
      return; // Don't play sound if page is not focused
    }

    isPlayingRef.current = true;

    try {
      switch (type) {
        case 'success':
          await playSuccessSound(userContext);
          break;
        case 'error':
          await playErrorSound(userContext);
          break;
        case 'warning':
          await playWarningSound(userContext);
          break;
        case 'info':
          await playInfoSound(userContext);
          break;
        case 'order':
          await playOrderSound(userContext);
          break;
        default:
          await playInfoSound(userContext);
      }
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    } finally {
      isPlayingRef.current = false;
    }
  }, []);

  const playTestSound = useCallback((type: NotificationType = 'info') => {
    console.log(`Playing ${type} sound for ${userContext} user context`);
    playSound(type);
  }, [playSound, userContext]);

  return {
    playSound,
    playTestSound,
    isPlaying: isPlayingRef.current,
  };
};

// Helper hook for auto-playing sounds with notifications
export const useNotificationSoundEffect = (options: UseNotificationSoundOptions = {}) => {
  const { playSound } = useNotificationSound(options);
  const userContext = useUserContext();

  return useCallback((type: NotificationType, soundEnabled = true) => {
    if (soundEnabled) {
      console.log(`Notification sound triggered: ${type} for ${userContext}`);
      playSound(type);
    }
  }, [playSound, userContext]);
};