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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { SiteClosureSection } from '../site-closure-section'

const openState = { closed: false, since: 0, notice: 'Back at noon.' }

function Fixture() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <SiteClosureSection />
      </SettingsPageProvider>
    </>
  )
}

async function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <Fixture />
    </QueryClientProvider>
  )
  return screen.findByRole('switch', { name: 'Close the site' })
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: openState },
  })
  vi.spyOn(api, 'put').mockResolvedValue({
    data: { success: true, data: { ...openState, closed: true, since: 1700 } },
  })
  vi.spyOn(api, 'delete').mockResolvedValue({
    data: { success: true, data: { revoked: 3, users: 2 } },
  })
})

test('closing the site asks for confirmation and sends nothing before it is accepted', async () => {
  const toggle = await renderSection()

  await userEvent.click(toggle)

  // Switching the control on must not close anything by itself: the console
  // that would reopen the site is the one the closure locks out.
  expect(api.put).not.toHaveBeenCalled()
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('Close the site now?')).toBeInTheDocument()

  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Close the site' })
  )

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith(
    '/api/admin/site-closure/',
    { enabled: true, notice: 'Back at noon.' },
    expect.anything()
  )
})

test('reopening the site applies immediately without a confirmation', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { ...openState, closed: true, since: 1700 } },
  })
  vi.mocked(api.put).mockResolvedValue({
    data: { success: true, data: openState },
  })

  const toggle = await renderSection()
  await waitFor(() => expect(toggle).toBeChecked())

  await userEvent.click(toggle)

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(api.put).toHaveBeenCalledWith(
    '/api/admin/site-closure/',
    { enabled: false, notice: 'Back at noon.' },
    expect.anything()
  )
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('signing out all users only runs after the confirmation is accepted', async () => {
  await renderSection()

  await userEvent.click(
    screen.getByRole('button', { name: 'Sign out all users' })
  )

  expect(api.delete).not.toHaveBeenCalled()
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Sign out everyone' })
  )

  await waitFor(() =>
    expect(api.delete).toHaveBeenCalledWith('/api/admin/sessions/')
  )
})
