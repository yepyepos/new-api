import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'

import { NailongPrototype } from '../nailong-prototype'

async function renderPreview() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({ component: NailongPrototype }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('tab', { name: 'Back to the hideaway' })
  return userEvent.setup()
}

it('switches to registration with keyboard and only enables preview verification for a nonblank code', async () => {
  const user = await renderPreview()
  const login = screen.getByRole('tab', { name: 'Back to the hideaway' })
  login.focus()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: 'Get an entry ticket' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(
    screen.getByRole('tab', { name: 'Get an entry ticket' })
  ).toHaveAttribute('aria-selected', 'true')
  const verify = screen.getByRole('button', { name: 'Check my ticket' })
  expect(verify).toBeDisabled()
  await user.type(
    screen.getByRole('textbox', { name: 'Registration code' }),
    '   '
  )
  expect(verify).toBeDisabled()
  await user.type(
    screen.getByRole('textbox', { name: 'Registration code' }),
    'DESIGN-ONLY'
  )
  expect(verify).toBeEnabled()
  await user.click(verify)
  expect(screen.getByRole('status')).toHaveTextContent(
    'Visual preview only. No sign-in request was sent.'
  )
  expect(
    screen.getByText(
      'Registration-code verification is not connected in this preview.'
    )
  ).toBeVisible()
})

it('keeps Discord authentication simulated and preserves a link to the real login page', async () => {
  const user = await renderPreview()
  await user.click(
    screen.getByRole('button', { name: 'Continue with Discord' })
  )
  expect(screen.getByRole('status')).toHaveTextContent(
    'Visual preview only. No sign-in request was sent.'
  )
  expect(
    screen.getByRole('link', { name: 'Open original sign-in' })
  ).toHaveAttribute('href', 'http://localhost:3000/sign-in')
  await user.click(screen.getByRole('tab', { name: 'Get an entry ticket' }))
  expect(screen.getByRole('status')).toHaveTextContent(
    'Design preview — your account and settings are unchanged.'
  )
})
