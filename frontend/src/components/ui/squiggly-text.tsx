"use client";

import React, { useId } from "react";
import { motion, useReducedMotion, useTime, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export interface SquigglyTextProps {
  /** The text (or any node) to wrap with the squiggly effect. */
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Number of distinct displacement frames to cycle through. @default 5 */
  steps?: number;
  /** Time between filter swaps, in milliseconds. @default 80 */
  stepDuration?: number;
  /** Maximum displacement in px. @default [6, 8] */
  scale?: number | [number, number];
  /** Turbulence base frequency. @default 0.02 */
  baseFrequency?: number;
  /** Number of turbulence octaves. @default 3 */
  numOctaves?: number;
  /** Render the wrapper as this element type. @default "span" */
  as?: "span" | "div";
}

export function SquigglyText({
  children,
  steps = 5,
  stepDuration = 80,
  scale = [6, 8],
  baseFrequency = 0.02,
  numOctaves = 3,
  as = "span",
  className,
  style,
}: SquigglyTextProps) {
  const reactId = useId();
  const safeId = reactId.replace(/[:_]/g, "");
  const filterId = (index: number) => `squiggly-${safeId}-${index}`;

  const filters = React.useMemo(
    () => Array.from({ length: steps }, (_, index) => `url(#${filterId(index)})`),
    // filterId is stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, safeId],
  );

  const time = useTime();
  const animatedFilter = useTransform(
    time,
    (elapsed) => filters[Math.floor(elapsed / stepDuration) % filters.length],
  );
  const prefersReducedMotion = useReducedMotion();
  const activeFilter = prefersReducedMotion ? undefined : animatedFilter;
  const scaleAt = (index: number) => Array.isArray(scale) ? scale[index % scale.length] : scale;
  const Wrapper = as === "div" ? motion.div : motion.span;

  return (
    <Wrapper
      style={{ filter: activeFilter, display: "inline-block", ...style }}
      className={cn("inline-block", className)}
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {Array.from({ length: steps }).map((_, index) => (
            <filter id={filterId(index)} key={index}>
              <feTurbulence
                baseFrequency={baseFrequency}
                numOctaves={numOctaves}
                result="noise"
                seed={index}
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={scaleAt(index)}
              />
            </filter>
          ))}
        </defs>
      </svg>
      {children}
    </Wrapper>
  );
}
