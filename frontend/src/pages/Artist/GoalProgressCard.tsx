import { useId } from 'react'
import './GoalProgressCard.css'

export type MonthlyStudioGoal = {
  completed: number
  target: number
}

type GoalProgressCardProps = {
  goal?: MonthlyStudioGoal | null
}

export function GoalProgressCard({ goal = null }: GoalProgressCardProps) {
  const titleId = `studio-goal-title-${useId().replace(/:/g, '')}`
  const hasGoal = Boolean(
    goal &&
    Number.isInteger(goal.target) && goal.target > 0 &&
    Number.isFinite(goal.completed) && Number.isInteger(goal.completed),
  )
  const completed = hasGoal && goal ? Math.max(0, goal.completed) : 0
  const target = hasGoal && goal ? goal.target : 0
  const percent = hasGoal ? Math.min(100, Math.max(0, Math.round((completed / target) * 100))) : null
  const circumference = 2 * Math.PI * 34
  const strokeOffset = percent === null ? circumference : circumference - (percent / 100) * circumference

  return (
    <article className="goal-progress-card" aria-labelledby={titleId}>
      <header className="goal-progress-header">
        <h2 id={titleId}>Monthly Studio Goal</h2>
        <p>Published artworks this month</p>
      </header>
      <div className="goal-progress-content">
        <div className="goal-progress-ring" role="img" aria-label={percent === null ? 'Monthly publishing goal unavailable' : `${percent}% of monthly publishing goal`}>
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle className="goal-progress-track" cx="40" cy="40" r="34" fill="none" strokeWidth="6" />
            <circle
              className="goal-progress-value"
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="var(--studio-muted)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeOpacity={percent === null ? 0 : 1}
            />
          </svg>
          <span className="goal-progress-percent">{percent === null ? '—' : `${percent}%`}</span>
        </div>
        <div className="goal-progress-details" aria-live="polite">
          {percent === null ? <>
            <strong>Goal unavailable</strong>
            <p>Monthly goal and publishing data are not connected yet.</p>
          </> : <>
            <strong>{completed} of {target} artworks published</strong>
            <p>Keep sharing your work with the collection.</p>
          </>}
        </div>
      </div>
    </article>
  )
}
