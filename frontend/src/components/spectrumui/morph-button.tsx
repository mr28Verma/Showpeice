import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import './morph-button.css'

type MorphButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick' | 'type'> & {
  children: ReactNode
  onAction: () => void | boolean | Promise<void | boolean>
  loadingLabel?: string
  successLabel?: string
  successDuration?: number
  onSuccess?: () => void
  type?: 'button' | 'submit'
}

export function MorphButton({
  children,
  onAction,
  loadingLabel = 'Loading',
  successLabel = 'Done',
  successDuration = 1200,
  onSuccess,
  type = 'button',
  className = '',
  disabled = false,
  ...buttonProps
}: MorphButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const actionInProgress = useRef(false)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current)
  }, [])

  const runAction = async () => {
    if (disabled || actionInProgress.current) return

    actionInProgress.current = true
    setStatus('loading')

    try {
      const succeeded = await onAction()
      if (succeeded === false) {
        actionInProgress.current = false
        setStatus('idle')
        return
      }

      setStatus('success')
      successTimer.current = setTimeout(() => {
        setStatus('idle')
        actionInProgress.current = false
        onSuccess?.()
      }, successDuration)
    } catch {
      actionInProgress.current = false
      setStatus('idle')
    }
  }

  const stateClass = status === 'idle' ? '' : `morph-button--${status}`
  const classes = ['morph-button', stateClass, className].filter(Boolean).join(' ')

  return (
    <button
      {...buttonProps}
      type={type}
      className={classes}
      disabled={disabled || status !== 'idle'}
      aria-busy={status === 'loading'}
      onClick={(event) => {
        if (type === 'submit') event.preventDefault()
        void runAction()
      }}
    >
      <span className="morph-button__content" aria-live="polite">
        {status === 'loading' ? (
          <>
            <span className="morph-button__spinner" aria-hidden="true" />
            <span>{loadingLabel}</span>
          </>
        ) : status === 'success' ? (
          <>
            <span className="morph-button__check" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <path d="m3 8 3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>{successLabel}</span>
          </>
        ) : children}
      </span>
    </button>
  )
}
