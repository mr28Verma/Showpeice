import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Angry, Check, Frown, Laugh, Loader2, Smile } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import './feedback-card.css'

const ratings = [
  { value: 4, label: 'Excellent', Icon: Laugh },
  { value: 3, label: 'Good', Icon: Smile },
  { value: 2, label: 'Poor', Icon: Frown },
  { value: 1, label: 'Very poor', Icon: Angry },
]

type FeedbackState = 'idle' | 'loading' | 'previewed'

export function FeedbackCard() {
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<FeedbackState>('idle')
  const [error, setError] = useState('')
  const ratingRefs = useRef<Array<HTMLButtonElement | null>>([])
  const submitTimer = useRef<number | undefined>(undefined)
  const reducedMotion = useReducedMotion()

  useEffect(() => () => {
    if (submitTimer.current !== undefined) window.clearTimeout(submitTimer.current)
  }, [])

  const chooseRating = (value: number) => {
    if (state === 'loading') return
    setRating(value)
    setError('')
    setState('idle')
  }

  const handleRatingKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % ratings.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + ratings.length) % ratings.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = ratings.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    chooseRating(ratings[nextIndex].value)
    ratingRefs.current[nextIndex]?.focus()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (state === 'loading') return
    if (rating === null) {
      setError('Choose a rating before submitting.')
      ratingRefs.current[0]?.focus()
      return
    }

    setError('')
    setState('loading')
    // No feedback endpoint exists in this project. This short local state transition
    // demonstrates the interaction without sending or persisting the response.
    submitTimer.current = window.setTimeout(() => {
      submitTimer.current = undefined
      setState('previewed')
    }, 550)
  }

  return <motion.form
    className={`feedback-card${rating !== null || error ? ' is-expanded' : ''}`}
    onSubmit={handleSubmit}
    aria-busy={state === 'loading'}
    layout
    initial={false}
    animate={{ borderRadius: rating !== null || error ? 18 : 999 }}
    transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeInOut' }}
    noValidate
  >
    <div className="feedback-card-top">
      <h2>How was your experience?</h2>
      <div
        className="feedback-rating-list"
        role="radiogroup"
        aria-label="Rate your experience"
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'feedback-error' : undefined}
      >
        {ratings.map(({ value, label, Icon }, index) => {
          const selected = rating === value
          return <motion.button
            key={value}
            ref={(element) => { ratingRefs.current[index] = element }}
            className={`feedback-rating${selected ? ' is-selected' : ''}`}
            data-rating={label.toLowerCase().replace(/\s+/g, '-')}
            type="button"
            role="radio"
            disabled={state === 'loading'}
            aria-label={label}
            aria-checked={selected}
            tabIndex={selected || (rating === null && index === 0) ? 0 : -1}
            onClick={() => chooseRating(value)}
            onKeyDown={(event) => handleRatingKeyDown(event, index)}
            whileTap={reducedMotion ? undefined : { scale: 0.94 }}
            animate={{ scale: selected ? 1.03 : 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
          ><Icon size={21} strokeWidth={1.8} aria-hidden="true"/><span className="sr-only">{label}</span></motion.button>
        })}
      </div>
    </div>

    <AnimatePresence initial={false}>
      {rating !== null && <motion.div
        className="feedback-details"
        key="feedback-details"
        initial={reducedMotion ? false : { height: 0, opacity: 0, y: 8 }}
        animate={{ height: 'auto', opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { height: 0, opacity: 0, y: 8 }}
        transition={{ duration: reducedMotion ? 0 : 0.26, ease: 'easeInOut' }}
      >
        <label className="sr-only" htmlFor="experience-feedback">Optional written feedback</label>
        <textarea
          id="experience-feedback"
          value={comment}
          onChange={(event) => { setComment(event.target.value); setState('idle') }}
          placeholder="Tell us what you think..."
          rows={3}
          maxLength={1000}
          aria-label="Optional written feedback"
          disabled={state === 'loading'}
        />
        <div className="feedback-actions">
          <AnimatePresence mode="wait" initial={false}>
            {state === 'previewed'
              ? <motion.p key="previewed" className="feedback-status" role="status" initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}><Check size={15} aria-hidden="true"/>Thanks for the feedback. This preview doesn’t send or save responses.</motion.p>
              : <motion.button key="submit" className="feedback-submit" type="submit" disabled={state === 'loading'} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.12 }}>
                {state === 'loading' && <Loader2 className="feedback-spinner" size={15} aria-hidden="true"/>}
                {state === 'loading' ? 'Preparing…' : 'Submit Feedback'}
              </motion.button>}
          </AnimatePresence>
        </div>
      </motion.div>}
    </AnimatePresence>

    <AnimatePresence initial={false}>
      {error && <motion.p id="feedback-error" className="feedback-error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>{error}</motion.p>}
    </AnimatePresence>
  </motion.form>
}
