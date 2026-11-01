import { TrendingUp } from 'lucide-react'
import './MonthlyRevenueCard.css'

export type MonthlyRevenueData = {
  currency: string
  currentMonthRevenue: number
  previousMonthRevenue: number | null
  dailyRevenue: Array<{ date: string; amount: number }>
}

type MonthlyRevenueCardProps = {
  data: MonthlyRevenueData | null
}

function formatRevenue(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`
  }
}

function RevenueTrend({ values }: { values: number[] }) {
  const validValues = values.length >= 2 && values.every(value => Number.isFinite(value) && value >= 0) ? values : []

  if (validValues.length < 2) {
    return (
      <div className="monthly-revenue-trend-empty" role="img" aria-label="Daily revenue trend unavailable">
        <span>Daily revenue trend unavailable</span>
      </div>
    )
  }

  const max = Math.max(...validValues, 1)
  const linePoints = validValues.map((value, index) => {
    const x = (index / (validValues.length - 1)) * 100
    const y = 27 - (value / max) * 23
    return `${x},${y}`
  }).join(' ')
  const finalY = 27 - (validValues[validValues.length - 1] / max) * 23

  return (
    <svg className="monthly-revenue-trend" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="Daily revenue trend this month">
      <polyline points={linePoints} fill="none" stroke="var(--studio-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx="100" cy={finalY} r="1.8" fill="var(--studio-text)" />
    </svg>
  )
}

export function MonthlyRevenueCard({ data }: MonthlyRevenueCardProps) {
  const hasRevenue = data !== null && Number.isFinite(data.currentMonthRevenue) && data.currentMonthRevenue >= 0
  const previousRevenue = data?.previousMonthRevenue
  const previousIsComparable = typeof previousRevenue === 'number' && Number.isFinite(previousRevenue) && previousRevenue > 0
  const changePercent = hasRevenue && previousIsComparable
    ? ((data.currentMonthRevenue - previousRevenue) / previousRevenue) * 100
    : null

  return (
    <section className="monthly-revenue-card" aria-labelledby="monthly-revenue-title">
      <header className="monthly-revenue-header">
        <h2 id="monthly-revenue-title">Monthly revenue</h2>
        <TrendingUp size={18} strokeWidth={1.6} aria-hidden="true" />
      </header>
      {hasRevenue ? (
        <>
          <p className="monthly-revenue-amount">{formatRevenue(data.currentMonthRevenue, data.currency)}</p>
          {changePercent === null ? (
            <p className="monthly-revenue-comparison is-unavailable">Monthly comparison unavailable</p>
          ) : (
            <p className="monthly-revenue-comparison">
              <span className={changePercent > 0 ? 'is-positive' : changePercent < 0 ? 'is-negative' : ''}>
                {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
              </span>{' '}
              from last month
            </p>
          )}
          <RevenueTrend values={data.dailyRevenue.map(point => point.amount)} />
        </>
      ) : (
        <>
          <p className="monthly-revenue-amount">—</p>
          <p className="monthly-revenue-comparison is-unavailable">Revenue data unavailable</p>
          <div className="monthly-revenue-trend-empty" role="img" aria-label="Revenue trend unavailable because sales and payment tracking are not connected">
            <span>Revenue trends will appear when sales are tracked.</span>
          </div>
        </>
      )}
    </section>
  )
}
