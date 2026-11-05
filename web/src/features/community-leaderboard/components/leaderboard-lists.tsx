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
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { toIntlLocale } from '@/i18n/languages'

import type {
  CheckinLeaderboardRow,
  UsageLeaderboardRow,
} from '../api'

type RankedRowProps = {
  rank: number
  username: string
  valueLabel: string
}

function RankedRow(props: RankedRowProps) {
  return (
    <li className='flex items-center gap-3 py-2'>
      <span className='text-muted-foreground/80 w-8 shrink-0 text-right font-mono text-xs tabular-nums'>
        {props.rank}.
      </span>
      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
        {props.username}
      </span>
      <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
        {props.valueLabel}
      </span>
    </li>
  )
}

function EmptyHint(props: { message: string }) {
  return (
    <p className='text-muted-foreground px-6 py-10 text-center text-sm'>
      {props.message}
    </p>
  )
}

export function CheckinLeaderboardList(props: {
  rows: CheckinLeaderboardRow[]
}) {
  const { t } = useTranslation()
  if (props.rows.length === 0) {
    return <EmptyHint message={t('No one has checked in today yet.')} />
  }
  return (
    <ul className='divide-y'>
      {props.rows.map((row, index) => (
        <RankedRow
          key={row.user_id}
          rank={index + 1}
          username={row.username}
          valueLabel={formatQuotaWithCurrency(row.quota_awarded)}
        />
      ))}
    </ul>
  )
}

export function UsageLeaderboardList(props: {
  rows: UsageLeaderboardRow[]
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  if (props.rows.length === 0) {
    return <EmptyHint message={t('No usage recorded for this period.')} />
  }
  return (
    <ul className='divide-y'>
      {props.rows.map((row, index) => (
        <RankedRow
          key={row.user_id}
          rank={index + 1}
          username={row.username}
          valueLabel={formatQuotaWithCurrency(row.total_quota, { locale })}
        />
      ))}
    </ul>
  )
}

export function LeaderboardCard(props: {
  title: string
  children: ReactNode
}) {
  return (
    <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
      <div className='border-b p-4 sm:p-6'>
        <h3 className='text-base font-semibold tracking-tight sm:text-lg'>
          {props.title}
        </h3>
      </div>
      <div className='p-2 sm:p-3'>{props.children}</div>
    </Card>
  )
}
