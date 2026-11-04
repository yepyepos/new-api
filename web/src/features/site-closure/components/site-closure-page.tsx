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

import { RichContent } from '@/components/rich-content'
import { formatTimestampToDate } from '@/lib/format'
import { useSystemConfigStore } from '@/stores/system-config-store'

import type { SiteClosureState } from '../api'

type SiteClosurePageProps = {
  closure: SiteClosureState
}

/**
 * Full-screen closure notice.
 *
 * It renders instead of the routed page, so nothing behind it is mounted: the
 * login form cannot be reached, and a visitor without a session sees only the
 * announcement. It is deliberately not a dismissible dialog — a dialog would
 * leave the console usable underneath it.
 */
export function SiteClosurePage(props: SiteClosurePageProps) {
  const { t } = useTranslation()
  const systemName = useSystemConfigStore((state) => state.config.systemName)
  const since = props.closure.since

  return (
    <div className='bg-background flex min-h-svh flex-col items-center justify-center px-6 py-16'>
      <div className='w-full max-w-[640px] space-y-6'>
        <header className='space-y-2 text-center'>
          <p className='text-muted-foreground text-sm'>{systemName}</p>
          <h1 className='text-2xl font-semibold'>
            {t('The site is temporarily closed')}
          </h1>
          {since > 0 && (
            <p className='text-muted-foreground text-xs'>
              {t('Closed since {{time}}', {
                time: formatTimestampToDate(since),
              })}
            </p>
          )}
        </header>

        {props.closure.notice.trim() !== '' && (
          <div className='bg-muted/40 rounded-lg border p-4'>
            {/* The administrator authors this text; RichContent sanitises it. */}
            <RichContent breaks content={props.closure.notice} />
          </div>
        )}

        <p className='text-muted-foreground text-center text-sm'>
          {t('API and console access will resume once the site reopens.')}
        </p>
      </div>
    </div>
  )
}
