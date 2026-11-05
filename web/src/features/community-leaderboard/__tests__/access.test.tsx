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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { useCommunityLeaderboardVisible } from '../hooks/use-leaderboard-access'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAuthStore.getState().auth.reset()
})

function visibilityFor(role: number, publicEnabled?: boolean) {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    community_leaderboard_public: publicEnabled,
  })
  useAuthStore.getState().auth.setUser({ id: 1, username: 'alice', role })
  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }
  return renderHook(() => useCommunityLeaderboardVisible(), {
    wrapper: Wrapper,
  }).result
}

describe('community leaderboard visibility', () => {
  it('hides the boards from regular users while the public switch is off', () => {
    expect(visibilityFor(1, false).current).toBe(false)
    expect(visibilityFor(1, undefined).current).toBe(false)
  })

  it('shows the boards to regular users once the public switch is on', () => {
    expect(visibilityFor(1, true).current).toBe(true)
  })

  it('always shows the boards to administrators', () => {
    expect(visibilityFor(10, false).current).toBe(true)
  })
})
