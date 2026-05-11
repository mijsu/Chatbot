"use client";

import type { CSSProperties } from "react";

import { cx } from "@/lib/dotmatrix-core";
import { useDotMatrixPhases } from "@/lib/dotmatrix-hooks";
import { styleOpacity, stylePx, remapOpacityToTriplet } from "@/lib/dotmatrix-core";
import { useCyclePhase } from "@/lib/dotmatrix-hooks";
import { usePrefersReducedMotion } from "@/lib/dotmatrix-hooks";
import type { DotMatrixCommonProps } from "@/lib/dotmatrix-core";

export type DotmCircular8Props = DotMatrixCommonProps & {
  /** Enable bloom/glow effect on active dots */
  bloom?: boolean;
};

/**
 * 8 dots arranged in a circle with a smooth rotating chase animation.
 * Perfect for AI indicators, loading states, and identity markers.
 *
 * Layout on a 5×5 grid — dots at the midpoints and corners of the outer ring:
 *
 *     Row 0:        ●
 *     Row 1:    ●       ●
 *     Row 2:  ●           ●
 *     Row 3:    ●       ●
 *     Row 4:        ●
 */

const MATRIX_SIZE = 5;

const BASE_OPACITY = 0.1;
const MID_OPACITY = 0.4;
const HIGH_OPACITY = 0.95;

/** 8 dots positioned on a circle on a 5×5 grid (clockwise from top) */
const CIRCULAR_CELLS: Array<[row: number, col: number]> = [
  [0, 2], // top center
  [1, 3], // top-right
  [2, 4], // right
  [3, 3], // bottom-right
  [4, 2], // bottom center
  [3, 1], // bottom-left
  [2, 0], // left
  [1, 1], // top-left
];

const CIRCULAR_SET = new Set(CIRCULAR_CELLS.map(([r, c]) => `${r},${c}`));

function isWithinCircularMask(row: number, col: number): boolean {
  return CIRCULAR_SET.has(`${row},${col}`);
}

/**
 * Returns the clockwise order index (0–7) for a cell,
 * or -1 if the cell is not part of the circle.
 */
function clockwiseIndex(row: number, col: number): number {
  const key = `${row},${col}`;
  for (let i = 0; i < CIRCULAR_CELLS.length; i++) {
    if (`${CIRCULAR_CELLS[i][0]},${CIRCULAR_CELLS[i][1]}` === key) return i;
  }
  return -1;
}

function smoothstep01(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Rotating chase: a bright "head" sweeps clockwise around the ring.
 * Phase 0→1 represents one full revolution.
 */
function opacityForCell(row: number, col: number, phase: number, bloom: boolean): number {
  const idx = clockwiseIndex(row, col);
  if (idx < 0) return 0;

  const totalDots = CIRCULAR_CELLS.length;
  const t = phase * Math.PI * 2;

  // Each dot's position in the cycle (0–1)
  const dotAngle = (idx / totalDots) * Math.PI * 2;

  // Wave: cosine distance from the "head" position
  const delta = dotAngle - t;
  const wave = 0.5 + 0.5 * Math.cos(delta);
  const crest = smoothstep01(0.2, 0.95, wave);

  let opacity = BASE_OPACITY + crest * (HIGH_OPACITY - BASE_OPACITY);

  // Bloom: make the leading dot extra bright with a softer trail
  if (bloom) {
    const trail = 0.5 + 0.5 * Math.cos(delta - 0.4);
    const trailCrest = smoothstep01(0.3, 0.9, trail);
    opacity = Math.max(opacity, BASE_OPACITY + trailCrest * (HIGH_OPACITY - BASE_OPACITY) * 0.7);
    // Extra peak for the head dot
    if (crest > 0.85) {
      opacity = Math.min(1, opacity + 0.15);
    }
  }

  return Math.min(HIGH_OPACITY, opacity);
}

export function DotmCircular8({
  size = 32,
  dotSize = 4,
  color = "currentColor",
  ariaLabel = "AI",
  className,
  muted = false,
  dotClassName,
  speed = 1.2,
  animated = true,
  hoverAnimated = false,
  bloom = false,
  cellPadding,
  opacityBase,
  opacityMid,
  opacityPeak,
  boxSize,
  minSize,
}: DotmCircular8Props) {
  const reducedMotion = usePrefersReducedMotion();
  const { phase: matrixPhase, onMouseEnter, onMouseLeave } = useDotMatrixPhases({
    animated: Boolean(animated && !reducedMotion),
    hoverAnimated: Boolean(hoverAnimated && !reducedMotion),
    speed,
  });
  const cycleActive = !reducedMotion && matrixPhase !== "idle";
  const cyclePhase = useCyclePhase({
    active: cycleActive,
    cycleMsBase: 1400,
    speed,
  });

  const gap =
    cellPadding ?? Math.max(1, Math.floor((size - dotSize * MATRIX_SIZE) / (MATRIX_SIZE - 1)));
  const matrixSize = dotSize * MATRIX_SIZE + gap * (MATRIX_SIZE - 1);

  // Handle boxSize/minSize wrapper
  const useWrapper = boxSize != null && boxSize > 0;
  const outerDim = useWrapper
    ? (minSize != null && minSize > 0 ? Math.max(boxSize, minSize) : boxSize)
    : 0;
  const scale = useWrapper && matrixSize > 0 ? outerDim / matrixSize : 1;

  const rootStyle = {
    width: stylePx(!useWrapper ? (cellPadding == null ? size : matrixSize) : matrixSize),
    height: stylePx(!useWrapper ? (cellPadding == null ? size : matrixSize) : matrixSize),
    color,
  } as CSSProperties;

  const grid = (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cx("dmx-root", muted && "dmx-muted", !useWrapper && className)}
      style={rootStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="dmx-grid"
        style={{
          gap,
          gridTemplateColumns: `repeat(${MATRIX_SIZE}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${MATRIX_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: MATRIX_SIZE * MATRIX_SIZE }).map((_, index) => {
          const row = Math.floor(index / MATRIX_SIZE);
          const col = index % MATRIX_SIZE;
          const isActive = isWithinCircularMask(row, col);

          const phase = reducedMotion || matrixPhase === "idle" ? 0.18 : cyclePhase;
          const opacity = isActive
            ? opacityForCell(row, col, phase, bloom)
            : 0;

          return (
            <span
              key={index}
              aria-hidden="true"
              className={cx("dmx-dot", !isActive && "dmx-inactive", dotClassName)}
              style={{
                width: stylePx(dotSize),
                height: stylePx(dotSize),
                opacity: styleOpacity(
                  remapOpacityToTriplet(opacity, opacityBase, opacityMid, opacityPeak)
                ),
                // Bloom glow effect via box-shadow on bright dots
                ...(bloom && isActive && opacity > 0.6
                  ? {
                      boxShadow: `0 0 ${dotSize * 1.5}px ${dotSize * 0.5}px currentColor`,
                    }
                  : {}),
              }}
            />
          );
        })}
      </div>
    </div>
  );

  if (useWrapper) {
    return (
      <div
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: outerDim,
          height: outerDim,
          minWidth: minSize,
          minHeight: minSize,
          overflow: "hidden",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {grid}
      </div>
    );
  }

  return grid;
}
