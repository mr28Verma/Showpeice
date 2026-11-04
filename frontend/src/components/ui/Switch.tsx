import type { ButtonHTMLAttributes } from 'react'

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'onClick' | 'type'> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function Switch({
  checked,
  onCheckedChange,
  className = '',
  ...props
}: SwitchProps) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      className={className}
      onClick={() => onCheckedChange(!checked)}
    >
      <span data-slot="switch-control">
        <span data-slot="switch-thumb" className="artist-settings-switch-knob" aria-hidden="true" />
      </span>
    </button>
  )
}
