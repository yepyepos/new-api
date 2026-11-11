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

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { formatQuotaWithCurrency } from '@/lib/currency'

import type { CheckinResponse } from '../types'

/** One labelled figure in the receipt. */
function CheckinStat(props: { label: string; value: string }) {
  return (
    <div className='flex items-baseline justify-between gap-4 py-1.5'>
      <span className='text-muted-foreground text-sm'>{props.label}</span>
      <span className='text-sm font-medium tabular-nums'>{props.value}</span>
    </div>
  )
}

/**
 * The receipt shown right after a check-in: what was awarded, where it placed
 * among today's check-ins, how long the streak runs, and how the award
 * compares with everyone else's. Every figure comes from the check-in
 * response, which is computed inside the same transaction as the award.
 */
export function CheckinSuccessDialog(props: {
  open: boolean
  result: CheckinResponse | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  if (!props.result) {
    return null
  }
  const result = props.result
  const rank = result.rank_today ?? 0
  const total = result.total_today ?? 0
  const streak = result.streak_days ?? 0
  const quotaRank = result.quota_rank_today ?? 0
  const percent = result.beats_percent ?? 0
  const rankValue =
    total === 1
      ? t('Only check-in today')
      : t('Check-in {{rank}} of {{count}} today', { rank, count: total })
  const streakValue =
    streak <= 1
      ? t('1 day (a new streak starts today)')
      : t('{{count}} days', { count: streak })
  const quotaRankValue = result.quota_rank_tied
    ? t('Place {{rank}} (tied)', { rank: quotaRank })
    : t('Place {{rank}}', { rank: quotaRank })
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose()
        }
      }}
      title={t('Check-in successful')}
      contentClassName='sm:max-w-sm'
      contentHeight='auto'
      footer={<Button onClick={props.onClose}>{t('Got it')}</Button>}
    >
      <div className='divide-y'>
        <CheckinStat
          label={t('This award')}
          value={formatQuotaWithCurrency(result.quota_awarded)}
        />
        <CheckinStat label={t("Today's check-in")} value={rankValue} />
        <CheckinStat
          label={t('Consecutive check-in days')}
          value={streakValue}
        />
        <CheckinStat label={t("Today's award rank")} value={quotaRankValue} />
      </div>
      <p className='text-muted-foreground pt-3 text-xs'>
        {percent > 0
          ? t("Beats {{percent}}% of today's check-ins", { percent })
          : t("Today's award sits at the back of the pack")}
      </p>
    </Dialog>
  )
}
