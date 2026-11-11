import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { SYSTEM_SETTINGS_VIEW } from '@/components/layout/config/system-settings.config'
import { QuotaSettingsSection } from '@/features/system-settings/general/quota-settings-section'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import { api } from '@/lib/api'
import { isCommercialPage } from '@/lib/community-mode'

import { Wallet } from '..'

afterEach(() => vi.restoreAllMocks())

function communityClient(checkinEnabled = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    public_benefit_mode_enabled: true,
    checkin_enabled: checkinEnabled,
  })
  return client
}

async function renderCommunity(client: QueryClient, content: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => content }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

it('shows quota and usage without fetching or mounting commercial features', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: { quota: 500000, used_quota: 100000, request_count: 3 },
    },
  })
  await renderCommunity(communityClient(), <Wallet initialShowHistory />)
  expect(await screen.findByText('Current Balance')).toBeVisible()
  expect(screen.getByText('Quota Center')).toBeVisible()
  for (const label of [
    'Add Funds',
    'Referral Program',
    'Order History',
    'Have a Code?',
  ]) {
    expect(screen.queryByText(label)).not.toBeInTheDocument()
  }
  expect(get).toHaveBeenCalledTimes(1)
  expect(get).toHaveBeenCalledWith('/api/user/self', expect.anything())
})

it('retains real daily check-in and refreshes the quota balance after claiming', async () => {
  let claimed = false
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/self') {
      return {
        data: {
          success: true,
          data: {
            quota: claimed ? 1000000 : 500000,
            used_quota: 0,
            request_count: 0,
          },
        },
      }
    }
    if (String(url).startsWith('/api/user/checkin')) {
      return {
        data: {
          success: true,
          data: {
            quota: 500000,
            min_quota: 500000,
            max_quota: 500000,
            timezone: 'Asia/Hong_Kong',
            today: '2026-10-31',
            stats: {
              checked_in_today: claimed,
              records: [],
              total_checkins: 0,
              total_quota: 0,
            },
          },
        },
      }
    }
    throw new Error(`Unexpected commercial request: ${url}`)
  })
  const post = vi.spyOn(api, 'post').mockImplementation(async () => {
    claimed = true
    return {
      data: {
        success: true,
        data: {
          quota_awarded: 500000,
          rank_today: 1,
          total_today: 1,
          streak_days: 1,
          quota_rank_today: 1,
          quota_rank_tied: false,
          beats_percent: 0,
        },
      },
    }
  })
  await renderCommunity(communityClient(true), <Wallet />)
  const user = userEvent.setup()
  // The card re-renders once its status query settles, so the button is read
  // after that instead of from the first paint.
  expect(await screen.findByRole('heading', { name: '2026-10' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Check in now' }))
  // The receipt opens on top of the card, so it is dismissed before the card
  // is read again.
  const receipt = await screen.findByRole('dialog')
  expect(receipt).toHaveTextContent('Only check-in today')
  await user.click(within(receipt).getByRole('button', { name: 'Got it' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Checked in' })).toBeDisabled()
  )
  expect(post).toHaveBeenCalledWith('/api/user/checkin')
  await waitFor(() =>
    expect(
      get.mock.calls.filter(([url]) => url === '/api/user/self')
    ).toHaveLength(2)
  )
  expect(await screen.findByText(/^\$2(?:\.00)?$/)).toBeVisible()
})

it('removes paid administration menus while preserving quota and check-in settings', () => {
  const client = communityClient()
  const wrapper = (props: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useSidebarData(), { wrapper })
  const links = result.current.navGroups.flatMap((group) => group.items)
  expect(links.some((item) => item.title === 'Quota Center')).toBe(true)
  expect(
    links.some((item) => 'url' in item && isCommercialPage(String(item.url)))
  ).toBe(false)
  const groups = SYSTEM_SETTINGS_VIEW.getNavGroups(i18next.t, true)
  const billing = groups
    .flatMap((group) => group.items)
    .find((item) => item.title === 'Quota & Usage')
  expect(
    billing &&
      'items' in billing &&
      billing.items?.some(
        (item) => item.url === '/system-settings/billing/checkin'
      )
  ).toBe(true)
  expect(
    billing &&
      'items' in billing &&
      billing.items?.some(
        (item) => item.url === '/system-settings/billing/payment'
      )
  ).toBe(false)
})

it('hides referral rewards and purchase-link configuration while keeping free signup quota', async () => {
  await renderCommunity(
    communityClient(),
    <QuotaSettingsSection
      complianceConfirmed={false}
      defaultValues={{
        QuotaForNewUser: 0,
        QuotaForInviter: 0,
        QuotaForInvitee: 0,
        TopUpLink: '',
        quota_setting: {
          trust_quota_usd: 1,
          pre_consume_multiplier: 1,
          enable_free_model_pre_consume: false,
        },
      }}
    />
  )
  expect(await screen.findByText('New User Quota')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  for (const label of ['Inviter Reward', 'Invitee Reward', 'Top-Up Link']) {
    expect(screen.queryByText(label)).not.toBeInTheDocument()
  }
})

it.each([
  '/subscriptions',
  '/subscriptions/',
  '/redemption-codes',
  '/system-settings/billing/payment',
])('recognizes a commercial page for redirect protection: %s', (path) =>
  expect(isCommercialPage(path)).toBe(true)
)

it.each([
  '/wallet',
  '/profile',
  '/system-settings/auth/registration',
  '/system-settings/billing/checkin',
])('preserves a community page: %s', (path) =>
  expect(isCommercialPage(path)).toBe(false)
)
