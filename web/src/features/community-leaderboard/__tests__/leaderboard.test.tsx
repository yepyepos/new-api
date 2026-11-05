import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosRequestConfig } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { CommunityLeaderboard } from '..'

afterEach(() => vi.restoreAllMocks())

function renderLeaderboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CommunityLeaderboard />
    </QueryClientProvider>
  )
}

it('lists today\'s check-in rewards and omits the board when nobody checked in', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        date: '2026-06-15',
        total: 0,
        rows: [],
        period: 'today',
      },
    },
  })
  renderLeaderboard()
  expect(
    await screen.findByText('No one has checked in today yet.')
  ).toBeVisible()
})

it('ranks check-in rewards and switches the usage leaderboard period', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(
    async (url: string, config?: AxiosRequestConfig<unknown>) => {
      if (url === '/api/community/checkin-leaderboard') {
        return {
          data: {
            success: true,
            data: {
              date: '2026-06-15',
              total: 2,
              rows: [
                { user_id: 2, username: 'lucky', quota_awarded: 2000000 },
                { user_id: 3, username: 'steady', quota_awarded: 500000 },
              ],
            },
          },
        }
      }
      const period = config?.params?.period ?? 'today'
      const username = period === 'today' ? 'today-heavy' : 'week-heavy'
      return {
        data: {
          success: true,
          data: {
            period,
            total: 1,
            rows: [{ user_id: 4, username, total_quota: 9000000 }],
          },
        },
      }
    }
  )
  renderLeaderboard()
  const items = await screen.findAllByRole('listitem')
  expect(items[0]).toHaveTextContent('lucky')
  expect(items[1]).toHaveTextContent('steady')
  expect(await screen.findByText('today-heavy')).toBeVisible()

  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: 'This week' }))
  await waitFor(() => expect(screen.getByText('week-heavy')).toBeVisible())
  expect(get).toHaveBeenCalledWith('/api/community/usage-leaderboard', {
    params: { period: 'week' },
  })
})
