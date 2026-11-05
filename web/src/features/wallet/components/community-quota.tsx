import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { CommunityLeaderboard } from '@/features/community-leaderboard'
import { CheckinCalendarCard } from '@/features/profile/components/checkin-calendar-card'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { getSelf } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import type { UserWalletData } from '../types'
import { WalletStatsCard } from './wallet-stats-card'

export function CommunityQuota() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const isAdmin =
    (useAuthStore((state) => state.auth.user?.role) ?? ROLE.GUEST) >= ROLE.ADMIN
  const leaderboardVisible =
    isAdmin || status?.community_leaderboard_public === true
  const user = useQuery<UserWalletData>({
    queryKey: ['community-quota'],
    queryFn: async () => requireServerSuccess(await getSelf()).data,
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Quota Center')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-5xl space-y-5'>
          <p className='text-muted-foreground text-sm'>
            {t('Daily check-ins provide free quota for community use.')}
          </p>
          {user.isError ? (
            <ErrorState onRetry={() => void user.refetch()} />
          ) : (
            <WalletStatsCard
              user={user.data ?? null}
              loading={user.isLoading}
            />
          )}
          {status?.checkin_enabled === true && (
            <CheckinCalendarCard
              checkinEnabled
              turnstileEnabled={status.turnstile_check === true}
              turnstileSiteKey={status.turnstile_site_key ?? ''}
              onCheckinSuccess={() => void user.refetch()}
            />
          )}
          {leaderboardVisible && <CommunityLeaderboard />}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
