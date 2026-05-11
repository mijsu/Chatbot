'use client';

import { DotmTriangle11 } from '@/components/ui/dotm-triangle-11';

interface AiOrbProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  showIcon?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { outer: 'w-12 h-12', loader: 20, dotSize: 3 },
  md: { outer: 'w-20 h-20', loader: 36, dotSize: 4 },
  lg: { outer: 'w-32 h-32', loader: 56, dotSize: 5 },
  xl: { outer: 'w-40 h-40', loader: 72, dotSize: 6 },
};

export default function AiOrb({ size = 'lg', animate = true, showIcon = true, className = '' }: AiOrbProps) {
  const s = sizeMap[size];
  const isXl = size === 'xl';

  return (
    <div className={`relative ${className}`}>
      {/* Main orb — flat circle with dot-grid interior */}
      <div
        className={`relative ${s.outer} rounded-full overflow-hidden flex items-center justify-center`}
        style={{
          border: '1px solid var(--nd-border-visible)',
          background: 'var(--nd-surface)',
        }}
      >
        {/* Dot-grid base layer */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, var(--nd-border-visible) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0',
            animation: animate
              ? 'nd-orb-pulse 4s cubic-bezier(0.25, 0.1, 0.25, 1) infinite'
              : 'none',
          }}
        />

        {/* XL surprise: secondary brighter dot layer at 2× spacing — interference pattern */}
        {isXl && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, var(--nd-text-disabled) 0.8px, transparent 0.8px)',
              backgroundSize: '32px 32px',
              backgroundPosition: '8px 8px',
              opacity: 0.6,
              animation: animate
                ? 'nd-orb-pulse 4s cubic-bezier(0.25, 0.1, 0.25, 1) infinite 2s'
                : 'none',
            }}
          />
        )}

        {/* XL surprise: tertiary sparse bright accent dots — constellation */}
        {isXl && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, var(--nd-text-secondary) 1.2px, transparent 1.2px)',
              backgroundSize: '48px 48px',
              backgroundPosition: '16px 16px',
              opacity: 0.4,
              animation: animate
                ? 'nd-orb-pulse 6s cubic-bezier(0.25, 0.1, 0.25, 1) infinite 1s'
                : 'none',
            }}
          />
        )}

        {/* Center icon — DotmTriangle11 AI indicator */}
        {showIcon && (
          <div className="relative z-10 flex items-center justify-center">
            <DotmTriangle11
              size={s.loader}
              dotSize={s.dotSize}
              speed={1.2}
              color="var(--nd-text-secondary)"
              bloom
              opacityBase={0.1}
              opacityMid={0.4}
              opacityPeak={0.95}
              animated={animate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
