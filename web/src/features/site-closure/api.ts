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
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export type SiteClosureState = {
  closed: boolean
  since: number
  notice: string
}

export type SetSiteClosureRequest = {
  enabled: boolean
  notice: string
}

const EMPTY_STATE: SiteClosureState = { closed: false, since: 0, notice: '' }

const parseClosureState = (data: unknown): SiteClosureState => {
  const record = (data ?? {}) as Partial<SiteClosureState>
  return {
    closed: record.closed === true,
    since: typeof record.since === 'number' ? record.since : 0,
    notice: typeof record.notice === 'string' ? record.notice : '',
  }
}

async function fetchSiteClosure(): Promise<SiteClosureState> {
  // Public and deliberately cheap, so a closed site is detected before the
  // visitor is authenticated. The client-wide no-store header is dropped here:
  // this one response must never be reused from the browser cache, and the
  // global rule would otherwise force a conditional revalidation each poll.
  const res = await api.get('/api/site-closure', {
    headers: { 'Cache-Control': null },
  })
  const body = requireServerSuccess(res.data)
  return body?.data ? parseClosureState(body.data) : EMPTY_STATE
}

/**
 * Read the closure state on every page.
 *
 * A closure is an emergency action: a tab that is already open has to learn
 * about it long before the five-minute `/api/status` cache expires, which is why
 * this polls its own endpoint instead of reading status.
 */
export function useSiteClosure() {
  const query = useQuery({
    queryKey: ['site-closure'],
    queryFn: fetchSiteClosure,
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  })
  return {
    closure: query.data ?? EMPTY_STATE,
    isLoading: query.isLoading,
  }
}

/** Close or reopen the site. Root only; the server enforces that. */
export async function setSiteClosure(
  request: SetSiteClosureRequest
): Promise<SiteClosureState> {
  const res = await api.put('/api/admin/site-closure/', request, {
    headers: { 'Cache-Control': null },
  })
  const body = requireServerSuccess(res.data)
  return body?.data ? parseClosureState(body.data) : EMPTY_STATE
}

/** Sign every dashboard user out at once. Root only. */
export async function revokeAllLoginSessions(): Promise<{
  revoked: number
  users: number
}> {
  const res = await api.delete('/api/admin/sessions/')
  const body = requireServerSuccess(res.data) as
    | { data?: { revoked?: number; users?: number } }
    | undefined
  return {
    revoked: typeof body?.data?.revoked === 'number' ? body.data.revoked : 0,
    users: typeof body?.data?.users === 'number' ? body.data.users : 0,
  }
}
