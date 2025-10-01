import { useState, useCallback, useRef } from 'react';

/**
 * Modal collision prevention and management
 * Ensures only one modal is open at a time
 */
export const useModalManager = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const modalLockRef = useRef<boolean>(false);

  const openModal = useCallback((modalId: string): boolean => {
    if (modalLockRef.current) {
      console.warn(`Modal collision prevented: ${modalId} blocked by ${activeModal}`);
      return false;
    }

    modalLockRef.current = true;
    setActiveModal(modalId);
    return true;
  }, [activeModal]);

  const closeModal = useCallback((modalId: string) => {
    if (activeModal === modalId) {
      modalLockRef.current = false;
      setActiveModal(null);
    }
  }, [activeModal]);

  const isModalOpen = useCallback((modalId: string) => {
    return activeModal === modalId;
  }, [activeModal]);

  return {
    openModal,
    closeModal,
    isModalOpen,
    activeModal,
  };
};
