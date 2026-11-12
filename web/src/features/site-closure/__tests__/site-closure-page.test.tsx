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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import { SiteClosurePage } from '../components/site-closure-page'

const closure = { closed: true, since: 1700, notice: 'Back at noon.' }

async function renderNotice() {
  const root = createRootRoute({
    component: () => <SiteClosurePage closure={closure} />,
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('link', { name: 'Administrator sign-in' })
  return { router, user: userEvent.setup() }
}

it('keeps the notice on screen with the announcement the administrator wrote', async () => {
  await renderNotice()

  expect(
    screen.getByRole('heading', { name: 'The site is temporarily closed' })
  ).toBeInTheDocument()
  expect(screen.getByText('Back at noon.')).toBeInTheDocument()
})

it('offers an administrator sign-in link so a signed-out operator can reach the console', async () => {
  const { router, user } = await renderNotice()

  // The closure notice replaces every other route, so this link is the only
  // way back to the switch that reopens the site.
  await user.click(screen.getByRole('link', { name: 'Administrator sign-in' }))

  expect(router.state.location.pathname).toBe('/sign-in')
})
