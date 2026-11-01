import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { IconMenu2, IconX } from '@tabler/icons-react'
import { lockBodyScroll } from '@/lib/body-scroll-lock'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/utils'
import './sidebar.css'

interface SidebarContextProps {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  animate: boolean
}

export interface SidebarLinkItem {
  label: string
  href: string
  icon: ReactNode
  active?: boolean
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined)

// This hook is an explicit part of the public sidebar API.
// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider')
  return context
}

export function SidebarProvider({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: ReactNode
  open?: boolean
  setOpen?: Dispatch<SetStateAction<boolean>>
  animate?: boolean
}) {
  const [openState, setOpenState] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const open = openProp ?? openState
  const setOpen = setOpenProp ?? setOpenState

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: animate && !prefersReducedMotion }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function Sidebar({
  children,
  open,
  setOpen,
  animate,
}: {
  children: ReactNode
  open?: boolean
  setOpen?: Dispatch<SetStateAction<boolean>>
  animate?: boolean
}) {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  )
}

export function SidebarBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
      <MobileSidebar className={className}>{children}</MobileSidebar>
    </>
  )
}

export function DesktopSidebar({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) {
  const { open, setOpen, animate } = useSidebar()

  return (
    <motion.div
      className={cn('aceternity-sidebar-desktop', open && 'is-open', className)}
      animate={{ width: animate ? (open ? '264px' : '68px') : '264px' }}
      transition={{ duration: animate ? 0.24 : 0, ease: 'easeInOut' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
      role="complementary"
      aria-label="Artist studio navigation"
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function MobileSidebar({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  const { open, setOpen, animate } = useSidebar()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const mobileNavigation = window.matchMedia('(max-width: 850px)')
    if (!open || !mobileNavigation.matches) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const releaseScrollLock = lockBodyScroll()
    closeButtonRef.current?.focus()

    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setOpen(false)
    }
    mobileNavigation.addEventListener('change', handleViewportChange)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key !== 'Tab') return
      const panel = closeButtonRef.current?.closest('[role="dialog"]')
      const focusable = panel?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      mobileNavigation.removeEventListener('change', handleViewportChange)
      releaseScrollLock()
      previousFocus?.focus()
    }
  }, [open, setOpen])

  return (
    <div className="aceternity-sidebar-mobile" {...props}>
      <button
        type="button"
        className="aceternity-sidebar-menu-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close artist studio navigation' : 'Open artist studio navigation'}
        aria-expanded={open}
        aria-controls="artist-studio-mobile-navigation"
      >
        <IconMenu2 size={21} stroke={1.7} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="artist-studio-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Artist studio navigation"
            initial={animate ? { x: '-100%', opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            exit={animate ? { x: '-100%', opacity: 0 } : { opacity: 0 }}
            transition={{ duration: animate ? 0.3 : 0, ease: 'easeInOut' }}
            className={cn('aceternity-sidebar-mobile-panel', className)}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false)
            }}
          >
            <button
              ref={closeButtonRef}
              type="button"
              className="aceternity-sidebar-close-button"
              onClick={() => setOpen(false)}
              aria-label="Close artist studio navigation"
            >
              <IconX size={21} stroke={1.7} aria-hidden="true" />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SidebarLink({
  link,
  className,
  onClick,
  ...props
}: {
  link: SidebarLinkItem
  className?: string
} & Omit<LinkProps, 'to' | 'children'>) {
  const { open, animate, setOpen } = useSidebar()

  return (
    <Link
      to={link.href}
      className={cn('aceternity-sidebar-link', link.active && 'is-active', className)}
      aria-label={link.label}
      aria-current={link.active ? 'page' : undefined}
      title={!open ? link.label : undefined}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && window.matchMedia('(max-width: 850px)').matches) setOpen(false)
      }}
      {...props}
    >
      {link.icon}
      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: animate ? 0.15 : 0 }}
        aria-hidden={animate && !open}
        className="aceternity-sidebar-link-label"
      >
        {link.label}
      </motion.span>
    </Link>
  )
}
