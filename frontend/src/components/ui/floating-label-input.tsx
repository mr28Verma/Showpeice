import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import './floating-label-input.css'

export const FloatingInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, placeholder, ...props }, ref) => (
    <input ref={ref} className={cn('showpeice-floating-input', className)} placeholder={placeholder ?? ' '} {...props} />
  ),
)
FloatingInput.displayName = 'FloatingInput'

export function FloatingLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('showpeice-floating-label', className)} {...props} />
}
