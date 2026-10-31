import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { z } from 'zod'

import { SignInPrototype } from '../sign-in-prototype'

async function renderPreview(variant = 'A') {
  const root = createRootRoute()
  const route = createRoute({
    getParentRoute: () => root,
    path: '/prototype/sign-in',
    validateSearch: z.object({ variant: z.enum(['A', 'B', 'C']).catch('A') }),
    component: SignInPrototype,
  })
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({
      initialEntries: [`/prototype/sign-in?variant=${variant}`],
    }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('heading', { name: 'Your community. Your access.' })
  return { router, user: userEvent.setup() }
}

it('cycles variants with buttons and wraps around while keeping the variant in the URL', async () => {
  const { router, user } = await renderPreview('C')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() =>
    expect(router.state.location.search).toEqual({ variant: 'A' })
  )
  await user.click(screen.getByRole('button', { name: 'Previous' }))
  await waitFor(() =>
    expect(router.state.location.search).toEqual({ variant: 'C' })
  )
})

it('switches variants with arrow keys without moving keyboard focus', async () => {
  const { router, user } = await renderPreview()
  const next = screen.getByRole('button', { name: 'Next' })
  next.focus()
  await user.keyboard('{ArrowRight}')
  await waitFor(() =>
    expect(router.state.location.search).toEqual({ variant: 'B' })
  )
  expect(next).toHaveFocus()
})

it('shows an explicit preview notice instead of attempting Discord authentication', async () => {
  const { user } = await renderPreview()
  await user.click(
    screen.getByRole('button', { name: 'Continue with Discord' })
  )
  expect(screen.getByRole('status')).toHaveTextContent(
    'Visual preview only. No sign-in request was sent.'
  )
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Open original sign-in' })
  ).toHaveAttribute('href', 'http://localhost:3000/sign-in')
})

it('falls back to variant A for an invalid variant URL', async () => {
  const { router } = await renderPreview('unknown')
  expect(router.state.location.search).toEqual({ variant: 'A' })
})
