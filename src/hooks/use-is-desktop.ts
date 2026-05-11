'use client';

import { useState, useEffect } from 'react';

const DESKTOP_BREAKPOINT = 1024; // matches Tailwind's `lg` breakpoint

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    mql.addEventListener('change', check);
    check();
    return () => mql.removeEventListener('change', check);
  }, []);

  return isDesktop;
}
