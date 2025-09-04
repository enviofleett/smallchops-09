import { useCallback, useRef, useEffect } from 'react';
import { NotificationType } from '@/context/NotificationContext';

interface NotificationSounds {
  success: string;
  error: string;
  warning: string;
  info: string;
  order: string;
}

// Create notification sounds using Web Audio API
const createNotificationSound = (frequency: number, duration: number, type: 'sine' | 'square' | 'triangle' = 'sine') => {
  return new Promise<void>((resolve) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

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

// Multi-tone sounds for different notification types
const playSuccessSound = async () => {
  await createNotificationSound(523, 0.2); // C5
  await createNotificationSound(659, 0.3); // E5
};

const playErrorSound = async () => {
  await createNotificationSound(200, 0.1, 'square');
  await createNotificationSound(150, 0.2, 'square');
};

const playWarningSound = async () => {
  await createNotificationSound(400, 0.15);
  await createNotificationSound(450, 0.15);
};

const playInfoSound = async () => {
  await createNotificationSound(800, 0.1);
  await createNotificationSound(600, 0.1);
};

const playOrderSound = async () => {
  await createNotificationSound(440, 0.1); // A4
  await createNotificationSound(554, 0.1); // C#5
  await createNotificationSound(659, 0.2); // E5
};

export interface UseNotificationSoundOptions {
  enabled?: boolean;
  volume?: number;
}

export const useNotificationSound = (options: UseNotificationSoundOptions = {}) => {
  const { enabled = true, volume = 0.5 } = options;
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
          await playSuccessSound();
          break;
        case 'error':
          await playErrorSound();
          break;
        case 'warning':
          await playWarningSound();
          break;
        case 'info':
          await playInfoSound();
          break;
        case 'order':
          await playOrderSound();
          break;
        default:
          await playInfoSound();
      }
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    } finally {
      isPlayingRef.current = false;
    }
  }, []);

  const playTestSound = useCallback((type: NotificationType = 'info') => {
    playSound(type);
  }, [playSound]);

  return {
    playSound,
    playTestSound,
    isPlaying: isPlayingRef.current,
  };
};

// Helper hook for auto-playing sounds with notifications
export const useNotificationSoundEffect = (options: UseNotificationSoundOptions = {}) => {
  const { playSound } = useNotificationSound(options);

  return useCallback((type: NotificationType, soundEnabled = true) => {
    if (soundEnabled) {
      playSound(type);
    }
  }, [playSound]);
};