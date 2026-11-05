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

import { SectionPageLayout } from '@/components/layout/components/section-page-layout'

import { CommunityLeaderboard } from '.'
import { useCommunityLeaderboardVisible } from './hooks/use-leaderboard-access'

/**
 * Standalone leaderboards page, so the boards keep a stable address instead of
 * living only inside the profile and quota pages.
 */
export function LeaderboardsPage() {
  const { t } = useTranslation()
  const visible = useCommunityLeaderboardVisible()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Leaderboards')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        {visible ? (
          <CommunityLeaderboard />
        ) : (
          <p className='text-muted-foreground py-16 text-center text-sm'>
            {t('Leaderboard is not available')}
          </p>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
