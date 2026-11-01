import { useSyncExternalStore } from 'react'
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react'
import { dismissToast, getServerToastsSnapshot, getToastsSnapshot, subscribeToasts, type ToastKind } from './toast'
import './ToastViewport.css'

const toastIcons = {
  success: IconCircleCheck,
  error: IconAlertTriangle,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
} satisfies Record<ToastKind, typeof IconInfoCircle>

export function ToastViewport() {
  const toasts = useSyncExternalStore(subscribeToasts, getToastsSnapshot, getServerToastsSnapshot)

  return (
    <div className="showpeice-toast-viewport" role="region" aria-label="Notifications">
      {toasts.map(item => {
        const Icon = toastIcons[item.kind]
        return (
          <article
            className={`showpeice-toast${item.isExiting ? ' is-exiting' : ''}`}
            data-kind={item.kind}
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            aria-live={item.kind === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            <Icon className="showpeice-toast-icon" size={19} stroke={1.7} aria-hidden="true" />
            <div className="showpeice-toast-copy">
              <strong>{item.title}</strong>
              {item.description && <p>{item.description}</p>}
            </div>
            <button
              type="button"
              className="showpeice-toast-dismiss"
              onClick={() => dismissToast(item.id)}
              aria-label={`Dismiss notification: ${item.title}`}
            >
              <IconX size={16} stroke={1.8} aria-hidden="true" />
            </button>
          </article>
        )
      })}
    </div>
  )
}
