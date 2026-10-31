import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, expect, it } from 'vitest'

import { NailongPrototype } from '@/features/auth/prototype/nailong-prototype'
import zh from '@/i18n/locales/zh.json'

import { NailongHomePrototype } from '../nailong-home-prototype'

afterEach(async () => {
  await i18next.changeLanguage('en')
  i18next.removeResourceBundle('zh', 'translation')
})

async function renderPreview() {
  const root = createRootRoute()
  const home = createRoute({
    getParentRoute: () => root,
    path: '/prototype/nailong-home',
    component: NailongHomePrototype,
  })
  const login = createRoute({
    getParentRoute: () => root,
    path: '/prototype/nailong',
    component: NailongPrototype,
  })
  const router = createRouter({
    routeTree: root.addChildren([home, login]),
    history: createMemoryHistory({
      initialEntries: ['/prototype/nailong-home'],
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
  await screen.findByRole('heading', { level: 1 })
  return userEvent.setup()
}

it('opens the login preview from the hero and returns to the home preview without authentication', async () => {
  const user = await renderPreview()
  await user.click(screen.getByRole('link', { name: 'Enter the hideaway' }))
  expect(
    await screen.findByRole('tab', { name: 'Back to the hideaway' })
  ).toBeVisible()
  await user.click(screen.getByRole('link', { name: 'Home' }))
  expect(
    await screen.findByRole('link', { name: 'Enter the hideaway' })
  ).toBeVisible()
})

it('keeps model links on the real catalog and makes external documentation links safe', async () => {
  await renderPreview()
  for (const link of screen.getAllByRole('link', { name: 'Models' })) {
    expect(link).toHaveAttribute('href', 'http://localhost:3000/pricing')
  }
  for (const link of screen.getAllByRole('link', { name: 'Docs' })) {
    expect(link).toHaveAttribute('href', 'https://docs.newapi.ai/')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
  expect(
    screen.getByText(
      'Design preview — your account and settings are unchanged.'
    )
  ).toBeVisible()
})

it('translates the introduction and feature labels when switching to Chinese', async () => {
  i18next.addResourceBundle('zh', 'translation', zh.translation)
  await renderPreview()
  expect(screen.getByText('A little more about us')).toBeVisible()

  await i18next.changeLanguage('zh')

  expect(await screen.findByText('再多了解我们一点')).toBeVisible()
  for (const label of ['01 / 探索灵感', '02 / 连接社区', '03 / 创造新事物']) {
    expect(screen.getByText(label)).toBeVisible()
  }
})
