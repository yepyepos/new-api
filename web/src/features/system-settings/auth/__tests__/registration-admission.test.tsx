import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { RegistrationAdmissionSection } from '../registration-admission-section'

afterEach(() => vi.restoreAllMocks())

async function renderAdmission() {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        batch: { enabled: true, limit: 3, used: 3 },
        ordinary_open: false,
        invites: [
          {
            id: 1,
            name: 'Existing invitation',
            exempt: true,
            max_uses: 5,
            used: 1,
            disabled: false,
            expires_at: 0,
          },
        ],
      },
    },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RegistrationAdmissionSection />
    </QueryClientProvider>
  )
  await screen.findByRole('heading', { name: 'Ordinary registration batch' })
  return userEvent.setup()
}

it('requires explicit confirmation to reset a full batch and does not reset when saving normally', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  const user = await renderAdmission()
  expect(
    screen.getByText(/Successful registrations in this batch/)
  ).toHaveTextContent('Closed')
  await user.click(
    screen.getByRole('button', { name: 'Save without resetting count' })
  )
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/option/registration/batch', {
      enabled: true,
      limit: 3,
      reset: false,
    })
  )
  await user.click(screen.getByRole('button', { name: 'Start a new batch' }))
  expect(screen.getByRole('alertdialog')).toBeVisible()
  expect(put).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() =>
    expect(put).toHaveBeenLastCalledWith('/api/option/registration/batch', {
      enabled: true,
      limit: 3,
      reset: true,
    })
  )
})

it('creates an exempt limited invitation and shows the usable code once without exposing it in the list', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { code: 'ONLY-SHOWN-ONCE' } },
  })
  const user = await renderAdmission()
  await user.type(
    screen.getByRole('textbox', { name: 'Name' }),
    'Community friends'
  )
  await user.clear(
    screen.getByRole('spinbutton', { name: 'Maximum successful registrations' })
  )
  await user.type(
    screen.getByRole('spinbutton', {
      name: 'Maximum successful registrations',
    }),
    '2'
  )
  await user.click(
    screen.getByRole('switch', { name: 'Exempt from community requirements' })
  )
  await user.click(screen.getByRole('button', { name: 'Create invitation' }))
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith('/api/option/registration/invites', {
      name: 'Community friends',
      max_uses: 2,
      exempt: true,
      expires_at: 0,
    })
  )
  expect(await screen.findByText('ONLY-SHOWN-ONCE')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Copy to clipboard' })
  ).toBeEnabled()
})

it('confirms disabling an invitation without deleting existing account admission', async () => {
  const remove = vi
    .spyOn(api, 'delete')
    .mockResolvedValue({ data: { success: true } })
  const user = await renderAdmission()
  await user.click(screen.getByRole('button', { name: 'Disable' }))
  expect(remove).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await waitFor(() =>
    expect(remove).toHaveBeenCalledWith('/api/option/registration/invites/1')
  )
})
