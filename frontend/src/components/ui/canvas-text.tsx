"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface CanvasTextProps {
  text: string;
  className?: string;
  backgroundClassName?: string;
  colors?: string[];
  animationDuration?: number;
  lineWidth?: number;
  lineGap?: number;
  curveIntensity?: number;
  overlay?: boolean;
}

function resolveColor(color: string): string {
  if (color.startsWith("var(")) {
    const varName = color.slice(4, -1).trim();
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return resolved || color;
  }

  return color;
}

export function CanvasText({
  text,
  className = "",
  backgroundClassName = "bg-white dark:bg-neutral-950",
  colors = ["#8a8a8a", "#b1b1b1", "#a1a1a1", "#c0c0c0", "#eaeaea", "#e5e5e5"],
  animationDuration = 5,
  lineWidth = 1.5,
  lineGap = 10,
  curveIntensity = 60,
  overlay = false,
}: CanvasTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const bgRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [bgColor, setBgColor] = useState("#0a0a0a");
  const [resolvedColors, setResolvedColors] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [font, setFont] = useState("");
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const updateColors = useCallback(() => {
    if (bgRef.current) {
      const computed = window.getComputedStyle(bgRef.current);
      setBgColor(computed.backgroundColor);
    }
    setResolvedColors(colors.map(resolveColor));
  }, [colors]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);

    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    updateColors();

    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [updateColors]);

  useEffect(() => {
    const textElement = textRef.current;
    if (!textElement) return;

    const updateDimensions = () => {
      const rect = textElement.getBoundingClientRect();
      const computed = window.getComputedStyle(textElement);
      setDimensions({
        width: Math.ceil(rect.width) || 400,
        height: Math.ceil(rect.height) || 200,
      });
      setFont(
        `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`,
      );
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(textElement);

    return () => resizeObserver.disconnect();
  }, [text, className]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      reducedMotion ||
      !canvas ||
      resolvedColors.length === 0 ||
      dimensions.width === 0 ||
      !font
    ) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const { width, height } = dimensions;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    context.font = font;
    const metrics = context.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;
    const baselineY = (height + ascent - descent) / 2;
    const lineCount = Math.floor(height / lineGap) + 10;
    startTimeRef.current = performance.now();

    const drawFrame = (currentTime: number) => {
      const elapsed = (currentTime - startTimeRef.current) / 1000;
      const phase = (elapsed / animationDuration) * Math.PI * 2;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "source-over";
      context.font = font;
      context.textBaseline = "alphabetic";
      context.textAlign = "left";
      context.fillStyle = "#000";
      context.fillText(text, 0, baselineY);

      context.globalCompositeOperation = "source-in";
      context.fillStyle = bgColor;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = "source-atop";
      for (let index = 0; index < lineCount; index++) {
        const y = index * lineGap;
        const curve1 = Math.sin(phase) * curveIntensity;
        const curve2 = Math.sin(phase + 0.5) * curveIntensity * 0.6;

        context.strokeStyle = resolvedColors[index % resolvedColors.length];
        context.lineWidth = lineWidth;
        context.beginPath();
        context.moveTo(0, y);
        context.bezierCurveTo(
          width * 0.33,
          y + curve1,
          width * 0.66,
          y + curve2,
          width,
          y,
        );
        context.stroke();
      }

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    animationRef.current = requestAnimationFrame(drawFrame);

    return () => cancelAnimationFrame(animationRef.current);
  }, [
    text,
    font,
    bgColor,
    resolvedColors,
    animationDuration,
    lineWidth,
    lineGap,
    curveIntensity,
    dimensions,
    reducedMotion,
  ]);

  if (reducedMotion) {
    return <span className={cn("canvas-text-static", className)}>{text}</span>;
  }

  return (
    <span
      className={cn(
        "relative inline-block",
        overlay && "absolute inset-0",
        "canvas-text-wrapper",
        overlay && "canvas-text-overlay",
        className,
      )}
    >
      <span
        ref={bgRef}
        className={cn(
          "pointer-events-none absolute h-0 w-0 opacity-0",
          "canvas-text-background",
          backgroundClassName,
        )}
        aria-hidden="true"
      />
      <span
        ref={textRef}
        className="invisible inline-block canvas-text-measure"
        aria-hidden="true"
      >
        {text}
      </span>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute top-0 left-0 canvas-text-canvas"
        style={{
          width: dimensions.width || "auto",
          height: dimensions.height || "auto",
        }}
        aria-label={text}
        role="img"
      />
    </span>
  );
}
