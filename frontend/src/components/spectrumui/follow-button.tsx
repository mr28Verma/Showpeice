import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import './follow-button.css'

export interface FollowButtonProps {
  following: boolean
  onFollowingChange: (following: boolean) => void
  followerCount?: number | null
  disabled?: boolean
  disabledReason?: string
}

export function FollowButton({
  following,
  onFollowingChange,
  followerCount,
  disabled = false,
  disabledReason,
}: FollowButtonProps) {
  const shouldReduceMotion = useReducedMotion()
  const reduceMotion = Boolean(shouldReduceMotion)
  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 400, damping: 30 }

  return (
    <div className="showpeice-follow-control">
      <motion.button
        type="button"
        className={`showpeice-follow-button${following ? ' is-following' : ''}`}
        aria-pressed={following}
        aria-label={`${following ? 'Unfollow' : 'Follow'} artist`}
        title={disabled ? disabledReason : undefined}
        disabled={disabled}
        onClick={() => onFollowingChange(!following)}
        whileTap={reduceMotion || disabled ? undefined : { scale: .97 }}
        transition={transition}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            className="showpeice-follow-button-content"
            key={following ? 'following' : 'follow'}
            initial={reduceMotion ? false : { y: following ? 8 : -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { y: following ? -8 : 8, opacity: 0 }}
            transition={transition}
          >
            {following ? <Check size={17} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
            <span>{following ? 'Following' : 'Follow'}</span>
          </motion.span>
        </AnimatePresence>
      </motion.button>
      {followerCount != null && Number.isSafeInteger(followerCount) && followerCount >= 0 && (
        <AnimatedFollowerCount count={followerCount} />
      )}
    </div>
  )
}

function AnimatedFollowerCount({ count }: { count: number }) {
  const shouldReduceMotion = useReducedMotion()
  const reduceMotion = Boolean(shouldReduceMotion)
  const [previousCount, setPreviousCount] = useState(count)
  const [direction, setDirection] = useState<1 | -1>(1)
  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 400, damping: 30 }

  if (count !== previousCount) {
    setPreviousCount(count)
    setDirection(count > previousCount ? 1 : -1)
  }

  return (
    <span className="showpeice-follow-count">
      <span className="showpeice-follow-count-value">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={count}
            className="showpeice-follow-count-number"
            initial={reduceMotion ? false : { y: direction * 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { y: direction * -10, opacity: 0 }}
            transition={transition}
          >
            {count.toLocaleString('en')}
          </motion.span>
        </AnimatePresence>
      </span>
      <span>followers</span>
    </span>
  )
}
