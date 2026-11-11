import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
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

it("lists today's check-in rewards and omits the board when nobody checked in", async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        date: '2026-06-15',
        total: 0,
        top: [],
        bottom: [],
        period: 'today',
      },
    },
  })
  renderLeaderboard()
  expect(
    await screen.findByText('No one has checked in today yet.')
  ).toBeVisible()
})

it('shows how many users checked in and used models, independent of the listed rows', async () => {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/api/community/checkin-leaderboard') {
      return {
        data: {
          success: true,
          data: {
            date: '2026-06-15',
            total: 89,
            top: [{ user_id: 2, username: 'lucky', quota_awarded: 2000000 }],
            bottom: [],
          },
        },
      }
    }
    return {
      data: {
        success: true,
        data: {
          period: 'today',
          total: 329,
          top: [{ user_id: 4, username: 'today-heavy', total_quota: 9000000 }],
          bottom: [],
        },
      },
    }
  })
  renderLeaderboard()
  expect(await screen.findByText('89 checked in today')).toBeVisible()
  expect(await screen.findByText('329 active users')).toBeVisible()
})

/** The collapsed response both cards get, and the expanded one they ask for. */
function mockLeaderboards() {
  return vi
    .spyOn(api, 'get')
    .mockImplementation(
      async (url: string, config?: AxiosRequestConfig<unknown>) => {
        const expanded = config?.params?.expanded === true
        if (url === '/api/community/checkin-leaderboard') {
          if (expanded) {
            return {
              data: {
                success: true,
                data: {
                  date: '2026-06-15',
                  total: 5,
                  truncated: false,
                  rows: [
                    {
                      user_id: 2,
                      username: 'lucky',
                      quota_awarded: 2000000,
                      rank: 1,
                    },
                    {
                      user_id: 3,
                      username: 'steady',
                      quota_awarded: 500000,
                      rank: 2,
                    },
                    {
                      user_id: 6,
                      username: 'middle',
                      quota_awarded: 300000,
                      rank: 3,
                    },
                    {
                      user_id: 7,
                      username: 'lower',
                      quota_awarded: 200000,
                      rank: 4,
                    },
                    {
                      user_id: 5,
                      username: 'unlucky',
                      quota_awarded: 100,
                      rank: 5,
                    },
                  ],
                },
              },
            }
          }
          return {
            data: {
              success: true,
              data: {
                date: '2026-06-15',
                total: 5,
                top: [
                  { user_id: 2, username: 'lucky', quota_awarded: 2000000 },
                  { user_id: 3, username: 'steady', quota_awarded: 500000 },
                ],
                bottom: [
                  { user_id: 5, username: 'unlucky', quota_awarded: 100 },
                ],
              },
            },
          }
        }
        const period = config?.params?.period ?? 'today'
        const username = period === 'today' ? 'today-heavy' : 'week-heavy'
        if (expanded) {
          return {
            data: {
              success: true,
              data: {
                period,
                total: 60,
                truncated: true,
                rows: [
                  { user_id: 4, username, total_quota: 9000000, rank: 1 },
                  {
                    user_id: 8,
                    username: 'light-user',
                    total_quota: 1000,
                    rank: 2,
                  },
                ],
              },
            },
          }
        }
        return {
          data: {
            success: true,
            data: {
              period,
              total: 60,
              top: [{ user_id: 4, username, total_quota: 9000000 }],
              bottom: [],
            },
          },
        }
      }
    )
}

it('ranks both ends, marks the hidden middle and switches the usage period', async () => {
  const get = mockLeaderboards()
  renderLeaderboard()
  const checkinCard = (
    await screen.findByText("Today's check-in leaderboard")
  ).closest('[data-card-hover]')
  expect(checkinCard).not.toBeNull()
  await within(checkinCard as HTMLElement).findByText('unlucky')
  const checkinItems = within(checkinCard as HTMLElement).getAllByRole(
    'listitem'
  )
  expect(checkinItems[0]).toHaveTextContent('1')
  expect(checkinItems[0]).toHaveTextContent('lucky')
  expect(checkinItems[1]).toHaveTextContent('2')
  expect(checkinItems[1]).toHaveTextContent('steady')
  expect(checkinItems[2]).toHaveTextContent('5')
  expect(checkinItems[2]).toHaveTextContent('unlucky')
  expect(
    within(checkinCard as HTMLElement).getByRole('button', {
      name: '2 more not shown',
    })
  ).toBeVisible()

  const usageCard = (await screen.findByText('Usage leaderboard')).closest(
    '[data-card-hover]'
  )
  expect(usageCard).not.toBeNull()
  await within(usageCard as HTMLElement).findByText('today-heavy')
  const usageItems = within(usageCard as HTMLElement).getAllByRole('listitem')
  expect(usageItems[0]).toHaveTextContent('1')
  expect(usageItems[0]).toHaveTextContent('today-heavy')
  expect(
    within(usageCard as HTMLElement).getByRole('button', {
      name: '59 more not shown',
    })
  ).toBeVisible()

  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: 'This week' }))
  expect(await screen.findByText('week-heavy')).toBeVisible()
  expect(get).toHaveBeenCalledWith('/api/community/usage-leaderboard', {
    params: { period: 'week' },
  })
})

it('reveals every row on demand and collapses back to the two ends', async () => {
  const get = mockLeaderboards()
  renderLeaderboard()
  const checkinCard = (
    await screen.findByText("Today's check-in leaderboard")
  ).closest('[data-card-hover]') as HTMLElement

  const expand = await within(checkinCard).findByRole('button', {
    name: '2 more not shown',
  })
  expect(expand).toHaveAttribute('aria-expanded', 'false')
  expect(get).not.toHaveBeenCalledWith('/api/community/checkin-leaderboard', {
    params: { expanded: true },
  })

  const user = userEvent.setup()
  await user.click(expand)
  const collapse = await screen.findByRole('button', { name: 'Collapse' })
  expect(collapse).toHaveAttribute('aria-expanded', 'true')
  expect(get).toHaveBeenCalledWith('/api/community/checkin-leaderboard', {
    params: { expanded: true },
  })
  const rows = await within(checkinCard).findAllByRole('listitem')
  expect(rows).toHaveLength(5)
  expect(rows[2]).toHaveTextContent('3')
  expect(rows[2]).toHaveTextContent('middle')
  expect(rows[4]).toHaveTextContent('5')
  expect(rows[4]).toHaveTextContent('unlucky')

  await user.click(collapse)
  expect(
    await within(checkinCard).findByRole('button', {
      name: '2 more not shown',
    })
  ).toHaveAttribute('aria-expanded', 'false')
  expect(within(checkinCard).getAllByRole('listitem')).toHaveLength(3)
})

it('says so when the expanded ranking itself is capped', async () => {
  mockLeaderboards()
  renderLeaderboard()
  const usageCard = (await screen.findByText('Usage leaderboard')).closest(
    '[data-card-hover]'
  ) as HTMLElement
  await within(usageCard).findByText('today-heavy')
  await userEvent
    .setup()
    .click(within(usageCard).getByRole('button', { name: '59 more not shown' }))
  expect(
    await within(usageCard).findByText('Showing the top 2 only')
  ).toBeVisible()
  expect(within(usageCard).getByText('light-user')).toBeVisible()
})
