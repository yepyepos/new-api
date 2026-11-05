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
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { LeaderboardPeriod } from './api'
import {
  CheckinLeaderboardList,
  LeaderboardCard,
  UsageLeaderboardList,
} from './components/leaderboard-lists'
import { useCheckinLeaderboard, useUsageLeaderboard } from './hooks/use-leaderboards'

const USAGE_PERIODS: LeaderboardPeriod[] = ['today', 'week', 'all']

const PERIOD_LABEL_KEYS: Record<LeaderboardPeriod, string> = {
  today: 'Today',
  week: 'This week',
  all: 'All time',
}

function PanelState(props: {
  loading: boolean
  failed: boolean
  onRetry: () => void
  children: ReactNode
}) {
  if (props.loading) {
    return <LoadingState />
  }
  if (props.failed) {
    return <ErrorState onRetry={props.onRetry} />
  }
  return props.children
}

export function CommunityLeaderboard() {
  const { t } = useTranslation()
  const [usagePeriod, setUsagePeriod] = useState<LeaderboardPeriod>('today')

  const checkinQuery = useCheckinLeaderboard()
  const usageQuery = useUsageLeaderboard(usagePeriod)

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-6'>
      <LeaderboardCard title={t("Today's check-in leaderboard")}>
        <PanelState
          loading={checkinQuery.isLoading}
          failed={checkinQuery.isError}
          onRetry={() => void checkinQuery.refetch()}
        >
          <CheckinLeaderboardList rows={checkinQuery.data?.rows ?? []} />
        </PanelState>
      </LeaderboardCard>

      <LeaderboardCard title={t('Usage leaderboard')}>
        <Tabs
          value={usagePeriod}
          onValueChange={(value) =>
            setUsagePeriod(value as LeaderboardPeriod)
          }
        >
          <TabsList className='mb-3'>
            {USAGE_PERIODS.map((period) => (
              <TabsTrigger key={period} value={period}>
                {t(PERIOD_LABEL_KEYS[period])}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={usagePeriod}>
            <PanelState
              loading={usageQuery.isLoading}
              failed={usageQuery.isError}
              onRetry={() => void usageQuery.refetch()}
            >
              <UsageLeaderboardList rows={usageQuery.data?.rows ?? []} />
            </PanelState>
          </TabsContent>
        </Tabs>
      </LeaderboardCard>
    </div>
  )
}
