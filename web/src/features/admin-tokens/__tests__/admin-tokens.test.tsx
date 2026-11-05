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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { AdminTokens } from '..'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

const clients: QueryClient[] = []

function token(id: number, userId: number, name: string) {
  return {
    id,
    name,
    key: 'abcd1234efgh5678ijkl',
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 0,
    accessed_time: 0,
    group: 'default',
    auto_groups: null,
    cross_group_retry: false,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
    user_id: userId,
    username: `user${userId}`,
    display_name: '',
  }
}

async function renderAdminTokens() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/admin/tokens/')) {
      return {
        data: {
          success: true,
          data: {
            items: [token(419, 107, 'filling'), token(421, 232, 'tauri')],
            total: 2,
            page: 1,
            page_size: 20,
          },
        },
      }
    }
    return { data: { success: true, data: {} } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {})
  clients.push(client)
  const root = createRootRoute()
  const auth = createRoute({ getParentRoute: () => root, id: '_authenticated' })
  const tokensRoute = createRoute({
    getParentRoute: () => auth,
    path: 'admin-tokens/',
    component: AdminTokens,
  })
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([tokensRoute])]),
    history: createMemoryHistory({ initialEntries: ['/admin-tokens/'] }),
  })
  await router.load()
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: {} } })
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  clients.splice(0).forEach((client) => client.clear())
})

it('renders the global admin token page with owner, name and masked key', async () => {
  await renderAdminTokens()
  expect(await screen.findByText('filling')).toBeInTheDocument()
  expect(screen.getByText('tauri')).toBeInTheDocument()
  expect(screen.getByText('user107')).toBeInTheDocument()
  expect(screen.getByText('user232')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'User' })).toBeInTheDocument()
  expect(
    screen.getByRole('columnheader', { name: 'Actions' })
  ).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith(
    expect.stringContaining('/api/admin/tokens/?p=1&page_size=20')
  )
})
