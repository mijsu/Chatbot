'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

/* ─── Types ─── */

interface SwipeableItemProps {
  children: React.ReactNode;
  onSwipeRight?: () => void; // Complete action
  onSwipeLeft?: () => void;  // Delete action
  rightLabel?: string;       // Default: "DONE"
  leftLabel?: string;        // Default: "DELETE"
  disabled?: boolean;        // Disable swiping (e.g., for completed items)
}

/* ─── Constants ─── */

const SWIPE_THRESHOLD = 80;

/* ─── Component ─── */

export default function SwipeableItem({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = 'DONE',
  leftLabel = 'DELETE',
  disabled = false,
}: SwipeableItemProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStart = useCallback((clientX: number) => {
    if (disabled) return;
    startXRef.current = clientX;
    currentXRef.current = clientX;
    setIsDragging(true);
    setIsAnimating(false);
  }, [disabled]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || disabled) return;
    currentXRef.current = clientX;
    const diff = currentXRef.current - startXRef.current;
    // Add resistance when swiping beyond threshold
    let newOffset = diff;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      const excess = Math.abs(diff) - SWIPE_THRESHOLD;
      const resisted = excess * 0.3;
      newOffset = diff > 0 ? SWIPE_THRESHOLD + resisted : -(SWIPE_THRESHOLD + resisted);
    }
    setOffset(newOffset);
  }, [isDragging, disabled]);

  const handleEnd = useCallback(() => {
    if (!isDragging || disabled) return;
    setIsDragging(false);
    setIsAnimating(true);

    if (offset > SWIPE_THRESHOLD) {
      // Swipe right — trigger complete
      setOffset(SWIPE_THRESHOLD);
      setTimeout(() => {
        onSwipeRight?.();
        setOffset(0);
        setTimeout(() => setIsAnimating(false), 300);
      }, 150);
    } else if (offset < -SWIPE_THRESHOLD) {
      // Swipe left — trigger delete
      setOffset(-SWIPE_THRESHOLD);
      setTimeout(() => {
        onSwipeLeft?.();
        setOffset(0);
        setTimeout(() => setIsAnimating(false), 300);
      }, 150);
    } else {
      // Spring back
      setOffset(0);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [isDragging, disabled, offset, onSwipeRight, onSwipeLeft]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  }, [handleStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  // Determine which action background to show
  const showRightAction = offset > 10;
  const showLeftAction = offset < -10;
  const rightActionProgress = Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);
  const leftActionProgress = Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ touchAction: disabled ? 'auto' : 'pan-y' }}
    >
      {/* Right action background (COMPLETE) */}
      {showRightAction && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-4 z-0"
          style={{
            width: `${rightActionProgress * 100}%`,
            maxWidth: '100%',
            background: 'var(--nd-success)',
            opacity: rightActionProgress,
          }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-white font-bold whitespace-nowrap"
          >
            {rightLabel}
          </span>
        </div>
      )}

      {/* Left action background (DELETE) */}
      {showLeftAction && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 z-0"
          style={{
            width: `${leftActionProgress * 100}%`,
            maxWidth: '100%',
            background: 'var(--nd-accent)',
            opacity: leftActionProgress,
          }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-white font-bold whitespace-nowrap"
          >
            {leftLabel}
          </span>
        </div>
      )}

      {/* Content */}
      <div
        className="relative z-10"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isAnimating ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
        }}
        onTouchStart={disabled ? undefined : handleTouchStart}
        onTouchMove={disabled ? undefined : handleTouchMove}
        onTouchEnd={disabled ? undefined : handleTouchEnd}
        onMouseDown={disabled ? undefined : handleMouseDown}
      >
        {children}
      </div>
    </div>
  );
}
