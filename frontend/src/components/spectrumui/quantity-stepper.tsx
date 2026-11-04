import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'

type QuantityStepperProps = {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

const HOLD_DELAY = 420
const HOLD_INTERVAL = 110

export function QuantityStepper({
  value,
  onValueChange,
  min = 1,
  max = Number.POSITIVE_INFINITY,
  ariaLabel = 'Quantity',
  className = '',
  disabled = false,
}: QuantityStepperProps) {
  const reducedMotion = useReducedMotion()
  const [direction, setDirection] = useState(1)
  const [boundaryPulse, setBoundaryPulse] = useState(0)
  const valueRef = useRef(value)
  const stepRef = useRef<(delta: number) => void>(() => undefined)
  const holdTimeoutRef = useRef<number | undefined>(undefined)
  const holdIntervalRef = useRef<number | undefined>(undefined)

  const stopHold = useCallback(() => {
    if (holdTimeoutRef.current !== undefined) window.clearTimeout(holdTimeoutRef.current)
    if (holdIntervalRef.current !== undefined) window.clearInterval(holdIntervalRef.current)
    holdTimeoutRef.current = undefined
    holdIntervalRef.current = undefined
  }, [])

  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => {
    stepRef.current = (delta) => {
      if (disabled) return
      const current = valueRef.current
      const next = Math.min(max, Math.max(min, current + delta))
      if (next === current) {
        setBoundaryPulse((pulse) => pulse + 1)
        stopHold()
        return
      }

      setDirection(delta)
      valueRef.current = next
      onValueChange(next)

      if (next === min || next === max) {
        setBoundaryPulse((pulse) => pulse + 1)
        stopHold()
      }
    }
  }, [disabled, max, min, onValueChange, stopHold])
  useEffect(() => stopHold, [stopHold])
  useEffect(() => {
    if (disabled) stopHold()
  }, [disabled, stopHold])

  const startHold = (delta: number, event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return
    stopHold()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is unavailable in a few embedded browsers; the button still works.
    }
    stepRef.current(delta)
    if (valueRef.current === min || valueRef.current === max) return
    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => stepRef.current(delta), HOLD_INTERVAL)
    }, HOLD_DELAY)
  }

  const canDecrement = value > min
  const canIncrement = value < max
  const pulseAnimation = boundaryPulse === 0
    ? { x: 0 }
    : boundaryPulse % 2
      ? { x: [0, -3, 3, -2, 2, 0] }
      : { x: [0, 3, -3, 2, -2, 0] }

  return <motion.div
    className={`quantity-stepper ${className}`.trim()}
    role="group"
    aria-label={ariaLabel}
    aria-busy={disabled}
    animate={reducedMotion ? undefined : pulseAnimation}
    transition={{ duration: 0.24, ease: 'easeOut' }}
    onPointerUp={stopHold}
    onPointerCancel={stopHold}
  >
    <button
      type="button"
      aria-label={`Decrease ${ariaLabel.toLowerCase()}`}
      disabled={disabled || !canDecrement}
      onPointerDown={(event) => startHold(-1, event)}
      onClick={(event) => { if (event.detail === 0) stepRef.current(-1) }}
    ><Minus size={14} aria-hidden="true"/></button>
    <span
      className="quantity-stepper-value"
      role="spinbutton"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={Number.isFinite(max) ? max : undefined}
      aria-valuenow={value}
      aria-disabled={disabled}
      aria-live="polite"
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); stepRef.current(1) }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); stepRef.current(-1) }
        else if (event.key === 'Home') { event.preventDefault(); valueRef.current = min; onValueChange(min); setDirection(-1) }
        else if (event.key === 'End' && Number.isFinite(max)) { event.preventDefault(); valueRef.current = max; onValueChange(max); setDirection(1) }
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="quantity-stepper-digit"
          initial={reducedMotion ? false : { y: direction > 0 ? 9 : -9, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reducedMotion ? undefined : { y: direction > 0 ? -9 : 9, opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
        >{value}</motion.span>
      </AnimatePresence>
    </span>
    <button
      type="button"
      aria-label={`Increase ${ariaLabel.toLowerCase()}`}
      disabled={disabled || !canIncrement}
      onPointerDown={(event) => startHold(1, event)}
      onClick={(event) => { if (event.detail === 0) stepRef.current(1) }}
    ><Plus size={14} aria-hidden="true"/></button>
  </motion.div>
}
