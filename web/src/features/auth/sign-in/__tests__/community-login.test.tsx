import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { UserAuthForm } from '../components/user-auth-form'

afterEach(() => {
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

async function renderLogin(invitationRegistration = false, legal = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], {
    discord_oauth: true,
    discord_client_id: 'client',
    password_login_enabled: true,
    user_agreement_enabled: legal,
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <UserAuthForm
          invitationRegistration={invitationRegistration}
          collapsePasswordLogin
        />
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('button', { name: 'Continue with Discord' })
  return userEvent.setup()
}

it('keeps invitation sign-in disabled until a code and required legal consent are provided', async () => {
  const user = await renderLogin(true, true)
  const discord = screen.getByRole('button', { name: 'Continue with Discord' })
  expect(discord).toBeDisabled()
  await user.type(
    screen.getByRole('textbox', { name: 'Registration code' }),
    'INVITATION-TEST'
  )
  expect(discord).toBeDisabled()
  await user.click(screen.getByRole('checkbox'))
  expect(discord).toBeEnabled()
  expect(screen.queryByLabelText('Username or Email')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Password sign-in' })
  ).not.toBeInTheDocument()
})

it('passes the invitation only in the server-owned Discord flow and uses the server authorization URL', async () => {
  const post = vi.spyOn(api, 'post').mockImplementation(async (url) => {
    if (url === '/api/user/auth/logout') return { data: { success: true } }
    return {
      data: {
        success: true,
        data: {
          flow_token: 'invite-state',
          authorization_url:
            'https://discord.com/oauth2/authorize?state=invite-state',
        },
      },
    }
  })
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  const user = await renderLogin(true)
  await user.type(
    screen.getByRole('textbox', { name: 'Registration code' }),
    'INVITATION-TEST'
  )
  await user.click(
    screen.getByRole('button', { name: 'Continue with Discord' })
  )
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/api/oauth/state',
      expect.objectContaining({
        provider: 'discord',
        intent: 'login',
        invite_code: 'INVITATION-TEST',
      }),
      expect.anything()
    )
  )
  expect(open).toHaveBeenCalledWith(
    'https://discord.com/oauth2/authorize?state=invite-state',
    '_self'
  )
  expect(window.localStorage.getItem('invite_code')).toBeNull()
})

it('keeps the existing password entry accessible through the themed disclosure', async () => {
  const user = await renderLogin()
  const recovery = screen.getByRole('button', { name: 'Password sign-in' })
  expect(recovery).toHaveAttribute('aria-expanded', 'false')
  await user.click(recovery)
  expect(recovery).toHaveAttribute('aria-expanded', 'true')
  expect(
    await screen.findByRole('textbox', { name: 'Username or Email' })
  ).toBeVisible()
  expect(screen.getByLabelText('Password', { exact: true })).toBeVisible()
})
