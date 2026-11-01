import './WeeklyActivityCard.css'

const WEEKDAYS = [
  { short: 'M', name: 'Monday' },
  { short: 'T', name: 'Tuesday' },
  { short: 'W', name: 'Wednesday' },
  { short: 'T', name: 'Thursday' },
  { short: 'F', name: 'Friday' },
  { short: 'S', name: 'Saturday' },
  { short: 'S', name: 'Sunday' },
] as const

export type WeeklyActivityData = {
  /** IANA timezone used to define the Monday–Sunday week. */
  timeZone: string
  /** Seven date/count pairs ordered Monday through Sunday for the current week. */
  days: Array<{ date: string; sessions: number }>
}

type WeeklyActivityCardProps = {
  data: WeeklyActivityData | null
}

function isValidWeek(data: WeeklyActivityData | null): data is WeeklyActivityData {
  if (!data || data.days.length !== WEEKDAYS.length || !data.timeZone.trim()) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: data.timeZone })
  } catch {
    return false
  }

  const dates = data.days.map(day => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isInteger(day.sessions) || day.sessions < 0) return null
    const timestamp = Date.parse(`${day.date}T00:00:00.000Z`)
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== day.date) return null
    return timestamp
  })

  if (dates.some(date => date === null)) return false
  return new Date(dates[0]!).getUTCDay() === 1 && dates.every((date, index) => date === dates[0]! + index * 86400000)
}

function formatDayDate(date: string) {
  const parsedDate = new Date(`${date}T12:00:00.000Z`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsedDate)
}

export function WeeklyActivityCard({ data }: WeeklyActivityCardProps) {
  const hasActivity = isValidWeek(data)
  const maxSessions = hasActivity ? Math.max(...data.days.map(day => day.sessions), 1) : 1

  return (
    <section className="weekly-activity-card" aria-labelledby="weekly-activity-title">
      <header className="weekly-activity-header">
        <div>
          <h2 id="weekly-activity-title">Weekly activity</h2>
          <p>Sessions per day</p>
        </div>
      </header>
      <div className="weekly-activity-chart" role="group" aria-label={hasActivity ? `Sessions each day, Monday through Sunday, timezone ${data.timeZone}` : 'Monday through Sunday activity; session counts unavailable'}>
        {WEEKDAYS.map((weekday, index) => {
          const day = hasActivity ? data.days[index] : null
          const dayDescription = day
            ? `${weekday.name}, ${formatDayDate(day.date)}: ${day.sessions} ${day.sessions === 1 ? 'session' : 'sessions'}`
            : `${weekday.name}: activity unavailable`

          return (
            <div className="weekly-activity-day" key={weekday.name} role="img" aria-label={dayDescription} title={dayDescription}>
              <div className={`weekly-activity-track${day ? ' has-data' : ' is-unavailable'}`}>
                {day && <span className="weekly-activity-bar" style={{ height: `${day.sessions / maxSessions * 100}%` }} />}
              </div>
              <span className="weekly-activity-day-label" aria-hidden="true">{weekday.short}</span>
            </div>
          )
        })}
      </div>
      <p className="weekly-activity-status">
        {hasActivity ? `Monday–Sunday · ${data.timeZone}` : 'Activity data unavailable · Session tracking is not connected.'}
      </p>
    </section>
  )
}
