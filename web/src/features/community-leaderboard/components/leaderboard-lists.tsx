/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toIntlLocale } from '@/i18n/languages'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

import type { CheckinLeaderboardRow, UsageLeaderboardRow } from '../api'

/** One rendered ranking row, built from either leaderboard's own row type. */
type LeaderboardEntry = {
  userId: number
  rank: number
  username: string
  valueLabel: string
}

/** Medal tints for the three leading ranks, neutral otherwise. */
function rankClassName(rank: number): string {
  if (rank === 1) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  if (rank === 2) return 'bg-slate-400/20 text-slate-700 dark:text-slate-200'
  if (rank === 3) return 'bg-orange-600/15 text-orange-700 dark:text-orange-300'
  return 'bg-muted text-muted-foreground'
}

function RankedRow(props: { entry: LeaderboardEntry }) {
  return (
    <li className='flex items-center gap-3 px-3 py-2'>
      <span
        className={cn(
          'w-8 shrink-0 rounded-md py-0.5 text-center font-mono text-xs font-semibold tabular-nums',
          rankClassName(props.entry.rank)
        )}
      >
        {props.entry.rank}
      </span>
      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
        {props.entry.username}
      </span>
      <span className='text-muted-foreground shrink-0 font-mono text-xs tabular-nums'>
        {props.entry.valueLabel}
      </span>
    </li>
  )
}

function RankedList(props: { entries: LeaderboardEntry[] }) {
  return (
    <ul className='divide-y'>
      {props.entries.map((entry) => (
        <RankedRow key={entry.userId} entry={entry} />
      ))}
    </ul>
  )
}

/** The rows a collapsed board keeps: both ends plus the real total. */
type LeaderboardEndsView = {
  top: LeaderboardEntry[]
  bottom: LeaderboardEntry[]
  total: number
}

/** The whole numbered ranking, fetched only after the reader expands it. */
type LeaderboardFullView = {
  rows: LeaderboardEntry[]
  total: number
  truncated: boolean
}

/** The row that both announces the hidden rows and reveals them. */
function HiddenRowsToggle(props: {
  hidden: number
  expanded: boolean
  loading: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const label = props.expanded
    ? t('Collapse')
    : t('{{count}} more not shown', { count: props.hidden })
  return (
    <div className='border-t'>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='text-muted-foreground h-10 w-full gap-1.5 rounded-none text-xs font-normal tabular-nums'
        onClick={props.onToggle}
        disabled={props.loading}
        aria-expanded={props.expanded}
      >
        <span>{label}</span>
        {props.expanded ? (
          <ChevronUp className='h-3.5 w-3.5' aria-hidden='true' />
        ) : (
          <ChevronDown className='h-3.5 w-3.5' aria-hidden='true' />
        )}
      </Button>
    </div>
  )
}

function ExpandedRanking(props: {
  full?: LeaderboardFullView
  loading: boolean
  failed: boolean
  onRetry: () => void
  onToggle: () => void
}) {
  const { t } = useTranslation()
  // The expanded rows are a second request, so the card reports its own
  // loading and failure states instead of collapsing to a bare "collapse" link.
  let body: ReactNode
  if (props.full) {
    body = (
      <div className='max-h-[60vh] overflow-y-auto'>
        <RankedList entries={props.full.rows} />
      </div>
    )
  } else if (props.failed) {
    body = <ErrorState className='min-h-0 py-8' onRetry={props.onRetry} />
  } else {
    body = <LoadingState />
  }
  return (
    <div>
      {body}
      {props.full?.truncated ? (
        <p className='text-muted-foreground border-t px-3 py-3 text-center text-xs tabular-nums'>
          {t('Showing the top {{count}} only', {
            count: props.full.rows.length,
          })}
        </p>
      ) : null}
      <HiddenRowsToggle
        hidden={0}
        expanded
        loading={props.loading}
        onToggle={props.onToggle}
      />
    </div>
  )
}

/**
 * The head of the ranking on the left and its tail on the right, with the
 * middle summarised so the card stays readable without pretending the ranking
 * is continuous. The summary line is the control that shows every row.
 */
function RankedEndsView(props: {
  ends: LeaderboardEndsView
  full?: LeaderboardFullView
  expanded: boolean
  loading: boolean
  failed: boolean
  onRetry: () => void
  onToggle: () => void
  emptyMessage: string
}) {
  if (props.expanded) {
    return (
      <ExpandedRanking
        full={props.full}
        loading={props.loading}
        failed={props.failed}
        onRetry={props.onRetry}
        onToggle={props.onToggle}
      />
    )
  }
  if (props.ends.top.length === 0) {
    return (
      <p className='text-muted-foreground px-6 py-10 text-center text-sm'>
        {props.emptyMessage}
      </p>
    )
  }
  const hidden = Math.max(
    0,
    props.ends.total - props.ends.top.length - props.ends.bottom.length
  )
  return (
    <div>
      <div className='grid grid-cols-1 gap-x-6 md:grid-cols-2'>
        <RankedList entries={props.ends.top} />
        {props.ends.bottom.length > 0 && (
          <div className='border-t md:border-t-0 md:border-l'>
            <RankedList entries={props.ends.bottom} />
          </div>
        )}
      </div>
      {hidden > 0 && (
        <HiddenRowsToggle
          hidden={hidden}
          expanded={false}
          loading={props.loading}
          onToggle={props.onToggle}
        />
      )}
    </div>
  )
}

export function CheckinLeaderboardList(props: {
  top: CheckinLeaderboardRow[]
  bottom: CheckinLeaderboardRow[]
  total: number
  full?: { rows: CheckinLeaderboardRow[]; total: number; truncated: boolean }
  expanded: boolean
  loading: boolean
  failed: boolean
  onRetry: () => void
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const toEntry = (row: CheckinLeaderboardRow, rank: number) => ({
    userId: row.user_id,
    rank,
    username: row.username,
    valueLabel: formatQuotaWithCurrency(row.quota_awarded),
  })
  const bottomStart = props.total - props.bottom.length + 1
  return (
    <RankedEndsView
      expanded={props.expanded}
      loading={props.loading}
      failed={props.failed}
      onRetry={props.onRetry}
      onToggle={props.onToggle}
      emptyMessage={t('No one has checked in today yet.')}
      ends={{
        total: props.total,
        top: props.top.map((row, index) => toEntry(row, index + 1)),
        bottom: props.bottom.map((row, index) =>
          toEntry(row, bottomStart + index)
        ),
      }}
      full={
        props.full
          ? {
              total: props.full.total,
              truncated: props.full.truncated,
              rows: props.full.rows.map((row, index) =>
                toEntry(row, row.rank ?? index + 1)
              ),
            }
          : undefined
      }
    />
  )
}

export function UsageLeaderboardList(props: {
  top: UsageLeaderboardRow[]
  bottom: UsageLeaderboardRow[]
  total: number
  full?: { rows: UsageLeaderboardRow[]; total: number; truncated: boolean }
  expanded: boolean
  loading: boolean
  failed: boolean
  onRetry: () => void
  onToggle: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const toEntry = (row: UsageLeaderboardRow, rank: number) => ({
    userId: row.user_id,
    rank,
    username: row.username,
    valueLabel: formatQuotaWithCurrency(row.total_quota, { locale }),
  })
  const bottomStart = props.total - props.bottom.length + 1
  return (
    <RankedEndsView
      expanded={props.expanded}
      loading={props.loading}
      failed={props.failed}
      onRetry={props.onRetry}
      onToggle={props.onToggle}
      emptyMessage={t('No usage recorded for this period.')}
      ends={{
        total: props.total,
        top: props.top.map((row, index) => toEntry(row, index + 1)),
        bottom: props.bottom.map((row, index) =>
          toEntry(row, bottomStart + index)
        ),
      }}
      full={
        props.full
          ? {
              total: props.full.total,
              truncated: props.full.truncated,
              rows: props.full.rows.map((row, index) =>
                toEntry(row, row.rank ?? index + 1)
              ),
            }
          : undefined
      }
    />
  )
}

export function LeaderboardCard(props: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <div className='border-b p-4 sm:p-6'>
        <h3 className='text-base font-semibold tracking-tight sm:text-lg'>
          {props.title}
        </h3>
        {props.subtitle ? (
          <p className='text-muted-foreground mt-1 text-xs tabular-nums'>
            {props.subtitle}
          </p>
        ) : null}
      </div>
      <div className='p-2 sm:p-3'>{props.children}</div>
    </Card>
  )
}
