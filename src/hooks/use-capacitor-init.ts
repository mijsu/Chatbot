'use client';

import { useEffect, useRef } from 'react';
import { isCapacitorNative } from '@/lib/capacitor-notifications';

/**
 * Hook to initialize Capacitor native features when the app starts.
 * In web mode, this is a no-op.
 */
export function useCapacitorInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!isCapacitorNative()) {
      return;
    }
    // Capacitor native init would go here
  }, []);
}
