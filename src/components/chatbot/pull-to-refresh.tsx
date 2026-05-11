'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/* ─── Types ─── */

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
  style?: React.CSSProperties;
}

/* ─── Constants ─── */

const PULL_THRESHOLD = 60;
const MAX_PULL = 120;

/* ─── Component ─── */

export default function PullToRefresh({
  children,
  onRefresh,
  className,
  style,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start tracking if scrolled to top
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    setIsAnimating(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || isRefreshing) return;

    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) {
      isDraggingRef.current = false;
      setPullDistance(0);
      return;
    }

    const diff = e.touches[0].clientY - startYRef.current;
    if (diff <= 0) {
      setPullDistance(0);
      return;
    }

    // Apply resistance the further they pull
    const resisted = Math.min(diff * 0.5, MAX_PULL);
    setPullDistance(resisted);
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      // Trigger refresh
      setIsAnimating(true);
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.6); // Collapse to indicator size

      try {
        await onRefresh();
      } catch {
        // Ignore refresh errors
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setTimeout(() => setIsAnimating(false), 300);
      }
    } else {
      // Spring back
      setIsAnimating(true);
      setPullDistance(0);
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div ref={containerRef} className={className} style={style}>
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center gap-2 overflow-hidden"
        style={{
          height: pullDistance > 0 ? `${pullDistance}px` : '0px',
          transition: isAnimating ? 'height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          opacity: pullDistance > 0 ? 1 : 0,
        }}
      >
        <RefreshCw
          className="w-4 h-4"
          style={{
            color: 'var(--nd-text-disabled)',
            strokeWidth: 1.5,
            animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
            transform: !isRefreshing ? `rotate(${progress * 360}deg)` : undefined,
            transition: isAnimating ? 'transform 0.3s ease' : 'none',
          }}
        />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.08em]"
          style={{ color: 'var(--nd-text-disabled)' }}
        >
          {isRefreshing ? 'REFRESHING...' : progress >= 1 ? 'RELEASE' : 'PULL'}
        </span>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ height: pullDistance > 0 ? `calc(100% - ${pullDistance}px)` : '100%' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
