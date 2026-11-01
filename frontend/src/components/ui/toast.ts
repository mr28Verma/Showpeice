export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export type ToastOptions = {
  title: string
  description?: string
  duration?: number
}

export type ToastInput = string | ToastOptions

export type ToastRecord = ToastOptions & {
  id: string
  kind: ToastKind
  isExiting: boolean
  signature: string
}

const DEFAULT_DURATION = 4500
const MAX_TOASTS = 4
const EXIT_DURATION = 180
const listeners = new Set<() => void>()
const dismissalTimers = new Map<string, ReturnType<typeof setTimeout>>()
const exitTimers = new Map<string, ReturnType<typeof setTimeout>>()
const EMPTY_TOASTS: ToastRecord[] = []
let records = EMPTY_TOASTS
let toastId = 0

function notifySubscribers() {
  listeners.forEach(listener => listener())
}

function clearTimers(id: string) {
  const dismissalTimer = dismissalTimers.get(id)
  if (dismissalTimer) clearTimeout(dismissalTimer)
  dismissalTimers.delete(id)

  const exitTimer = exitTimers.get(id)
  if (exitTimer) clearTimeout(exitTimer)
  exitTimers.delete(id)
}

function removeToast(id: string) {
  clearTimers(id)
  const next = records.filter(record => record.id !== id)
  if (next.length === records.length) return
  records = next
  notifySubscribers()
}

export function dismissToast(id: string) {
  const record = records.find(item => item.id === id)
  if (!record || record.isExiting) return

  const dismissalTimer = dismissalTimers.get(id)
  if (dismissalTimer) clearTimeout(dismissalTimer)
  dismissalTimers.delete(id)

  records = records.map(item => item.id === id ? { ...item, isExiting: true } : item)
  notifySubscribers()
  exitTimers.set(id, setTimeout(() => removeToast(id), EXIT_DURATION))
}

function pushToast(kind: ToastKind, input: ToastInput, description?: string) {
  const options = typeof input === 'string' ? { title: input, description } : input
  const signature = `${kind}\u0000${options.title}\u0000${options.description ?? ''}`
  const duplicate = records.find(record => record.signature === signature && !record.isExiting)
  if (duplicate) return duplicate.id

  const id = `showpeice-toast-${Date.now()}-${++toastId}`
  const record: ToastRecord = { ...options, id, kind, isExiting: false, signature }
  const next = [record, ...records]
  next.slice(MAX_TOASTS).forEach(item => clearTimers(item.id))
  records = next.slice(0, MAX_TOASTS)
  notifySubscribers()

  dismissalTimers.set(id, setTimeout(() => dismissToast(id), options.duration ?? DEFAULT_DURATION))
  return id
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToastsSnapshot() {
  return records
}

export function getServerToastsSnapshot() {
  return EMPTY_TOASTS
}

export const toast = {
  success: (input: ToastInput, description?: string) => pushToast('success', input, description),
  error: (input: ToastInput, description?: string) => pushToast('error', input, description),
  warning: (input: ToastInput, description?: string) => pushToast('warning', input, description),
  info: (input: ToastInput, description?: string) => pushToast('info', input, description),
  dismiss: dismissToast,
}
