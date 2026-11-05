import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { CheckinSettingsSection } from '../checkin-settings-section'

afterEach(() => {
  vi.restoreAllMocks()
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG },
  })
})

function Fixture(props: { quota?: number } = {}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <CheckinSettingsSection
          defaultValues={{
            enabled: true,
            minQuota: 500000,
            maxQuota: 2500000,
            quota: props.quota ?? 50,
            thresholdEnabled: true,
            balanceThreshold: 100,
            timezone: 'Asia/Hong_Kong',
            leaderboardPublic: false,
          }}
        />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

it('displays existing internal quotas in USD without rewriting their value', () => {
  const put = vi.spyOn(api, 'put')
  render(<Fixture />)
  expect(
    screen.getByRole('spinbutton', { name: 'Minimum check-in reward (USD)' })
  ).toHaveValue(1)
  expect(
    screen.getByRole('spinbutton', { name: 'Maximum check-in reward (USD)' })
  ).toHaveValue(5)
  expect(
    screen.getByRole('spinbutton', {
      name: 'Check-in balance threshold (USD)',
    })
  ).toHaveValue(0.0002)
  expect(put).not.toHaveBeenCalled()
})

it('saves a USD range as internal quota without changing the threshold', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  render(<Fixture />)
  const user = userEvent.setup()
  const min = screen.getByRole('spinbutton', {
    name: 'Minimum check-in reward (USD)',
  })
  await user.clear(min)
  await user.type(min, '2')
  await user.click(
    screen.getByRole('button', { name: 'Save check-in settings' })
  )
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/option/', {
      key: 'checkin_setting.min_quota',
      value: '1000000',
    })
  )
  expect(put).toHaveBeenCalledTimes(1)
  expect(
    screen.getByRole('spinbutton', { name: 'Check-in balance threshold (USD)' })
  ).toHaveValue(0.0002)
})

it('rejects an inverted reward range and keeps both-zero as the fallback', async () => {
  const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
  render(<Fixture />)
  const user = userEvent.setup()
  const min = screen.getByRole('spinbutton', {
    name: 'Minimum check-in reward (USD)',
  })
  const max = screen.getByRole('spinbutton', {
    name: 'Maximum check-in reward (USD)',
  })
  await user.clear(max)
  await user.type(max, '0.5')
  await user.click(
    screen.getByRole('button', { name: 'Save check-in settings' })
  )
  expect(put).not.toHaveBeenCalled()
  expect(
    await screen.findByText(
      'Set both rewards to enable the range, or leave both at zero to use the fallback reward'
    )
  ).toBeVisible()

  await user.clear(min)
  await user.type(min, '0')
  await user.clear(max)
  await user.type(max, '0')
  await user.click(
    screen.getByRole('button', { name: 'Save check-in settings' })
  )
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
  expect(put).toHaveBeenCalledWith('/api/option/', {
    key: 'checkin_setting.min_quota',
    value: '0',
  })
  expect(put).toHaveBeenCalledWith('/api/option/', {
    key: 'checkin_setting.max_quota',
    value: '0',
  })
})

it('saves the leaderboard visibility switch', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  render(<Fixture />)
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('switch', { name: 'Show leaderboards to users' })
  )
  await user.click(
    screen.getByRole('button', { name: 'Save check-in settings' })
  )
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/option/', {
      key: 'community_leaderboard.public_enabled',
      value: 'true',
    })
  )
})

it('keeps the exact stored amount when only the timezone changes', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  render(<Fixture quota={Number.MAX_SAFE_INTEGER - 2} />)
  const user = userEvent.setup()
  const timezone = screen.getByRole('textbox', { name: 'Check-in timezone' })
  await user.clear(timezone)
  await user.type(timezone, 'UTC')
  await user.click(
    screen.getByRole('button', { name: 'Save check-in settings' })
  )
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
  expect(put).toHaveBeenCalledWith('/api/option/', {
    key: 'checkin_setting.timezone',
    value: 'UTC',
  })
})
