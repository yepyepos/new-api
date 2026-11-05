import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { CheckinCalendarCard } from '../checkin-calendar-card'

afterEach(() => vi.restoreAllMocks())

it('uses the site day and keeps the daily chance available after a balance rejection', async () => {
  let awarded = false
  vi.spyOn(api, 'get').mockImplementation(async () => ({
    data: {
      success: true,
      data: {
        enabled: true,
        quota: 50,
        today: '2026-06-15',
        timezone: 'Asia/Hong_Kong',
        threshold_enabled: true,
        balance_threshold: 100,
        stats: {
          checked_in_today: awarded,
          total_quota: awarded ? 50 : 0,
          total_checkins: awarded ? 1 : 0,
          checkin_count: awarded ? 1 : 0,
          records: [],
        },
      },
    },
  }))
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValueOnce({
      data: {
        success: false,
        message:
          'Your balance is above the check-in threshold. Try again after using some quota.',
      },
    })
    .mockImplementation(async () => {
      awarded = true
      return { data: { success: true, data: { quota_awarded: 50 } } }
    })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CheckinCalendarCard
        checkinEnabled
        turnstileEnabled={false}
        turnstileSiteKey=''
      />
    </QueryClientProvider>
  )
  const user = userEvent.setup()
  expect(await screen.findByRole('heading', { name: '2026-06' })).toBeVisible()
  expect(screen.getByText(/Check-in timezone/)).toHaveTextContent(
    'Asia/Hong_Kong'
  )
  const claim = screen.getByRole('button', { name: 'Check in now' })
  await user.click(claim)
  await waitFor(() => expect(claim).toBeEnabled())
  expect(post).toHaveBeenCalledTimes(1)
  await user.click(claim)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Checked in' })).toBeDisabled()
  )
  expect(post).toHaveBeenCalledTimes(2)
})

it('shows the fixed reward when the operator has not configured a range', async () => {
  vi.spyOn(api, 'get').mockImplementation(async () => ({
    data: {
      success: true,
      data: {
        enabled: true,
        min_quota: 0,
        max_quota: 0,
        quota: 50,
        today: '2026-06-15',
        timezone: 'Asia/Hong_Kong',
        threshold_enabled: false,
        balance_threshold: 0,
        stats: {
          checked_in_today: false,
          total_quota: 0,
          total_checkins: 0,
          checkin_count: 0,
          records: [],
        },
      },
    },
  }))
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CheckinCalendarCard
        checkinEnabled
        turnstileEnabled={false}
        turnstileSiteKey=''
      />
    </QueryClientProvider>
  )
  expect(await screen.findByRole('heading', { name: '2026-06' })).toBeVisible()
  expect(screen.getByText(/Check-in reward:/)).toBeVisible()
  expect(
    screen.queryByText(/Random check-in reward range/)
  ).not.toBeInTheDocument()
})

it('shows the random reward range once the operator configures one', async () => {
  vi.spyOn(api, 'get').mockImplementation(async () => ({
    data: {
      success: true,
      data: {
        enabled: true,
        min_quota: 1000000,
        max_quota: 2500000,
        quota: 50,
        today: '2026-06-15',
        timezone: 'Asia/Hong_Kong',
        threshold_enabled: false,
        balance_threshold: 0,
        stats: {
          checked_in_today: false,
          total_quota: 0,
          total_checkins: 0,
          checkin_count: 0,
          records: [],
        },
      },
    },
  }))
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CheckinCalendarCard
        checkinEnabled
        turnstileEnabled={false}
        turnstileSiteKey=''
      />
    </QueryClientProvider>
  )
  expect(await screen.findByRole('heading', { name: '2026-06' })).toBeVisible()
  expect(screen.getByText(/Random check-in reward range/)).toBeVisible()
})
