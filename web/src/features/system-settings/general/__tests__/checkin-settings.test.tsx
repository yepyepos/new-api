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
            quota: props.quota ?? 50,
            thresholdEnabled: true,
            balanceThreshold: 100,
            timezone: 'Asia/Hong_Kong',
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
    screen.getByRole('spinbutton', { name: 'Fixed check-in reward (USD)' })
  ).toHaveValue(0.0001)
  expect(
    screen.getByRole('spinbutton', {
      name: 'Check-in balance threshold (USD)',
    })
  ).toHaveValue(0.0002)
  expect(put).not.toHaveBeenCalled()
})

it('saves a USD reward as internal quota without changing the threshold or restoring random rewards', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  render(<Fixture />)
  const user = userEvent.setup()
  const quota = screen.getByRole('spinbutton', {
    name: 'Fixed check-in reward (USD)',
  })
  await user.clear(quota)
  await user.type(quota, '1')
  await user.click(
    screen.getByRole('button', { name: 'Save check-in settings' })
  )
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/option/', {
      key: 'checkin_setting.quota',
      value: '500000',
    })
  )
  expect(put).toHaveBeenCalledTimes(1)
  expect(
    screen.getByRole('spinbutton', { name: 'Check-in balance threshold (USD)' })
  ).toHaveValue(0.0002)
})

it.each(['USD', 'CNY', 'TOKENS', 'CUSTOM'] as const)(
  'converts fractional rewards and thresholds using the actual quota ratio, not the %s display currency',
  async (quotaDisplayType) => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaPerUnit: 1000000,
        quotaDisplayType,
        usdExchangeRate: 7,
        customCurrencyExchangeRate: 3,
      },
    })
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue({ data: { success: true } })
    render(<Fixture />)
    const user = userEvent.setup()
    const quota = screen.getByRole('spinbutton', {
      name: 'Fixed check-in reward (USD)',
    })
    const threshold = screen.getByRole('spinbutton', {
      name: 'Check-in balance threshold (USD)',
    })
    expect(quota).toHaveValue(0.00005)
    await user.clear(quota)
    await user.type(quota, '0.01')
    await user.clear(threshold)
    await user.type(threshold, '5')
    await user.click(
      screen.getByRole('button', { name: 'Save check-in settings' })
    )
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
    expect(put).toHaveBeenCalledWith('/api/option/', {
      key: 'checkin_setting.quota',
      value: '10000',
    })
    expect(put).toHaveBeenCalledWith('/api/option/', {
      key: 'checkin_setting.balance_threshold',
      value: '5000000',
    })
  }
)

it.each(['0', '-1', '999999999999999999999'])(
  'does not save an invalid or overflowing USD reward: %s',
  async (value) => {
    const put = vi.spyOn(api, 'put')
    render(<Fixture />)
    const user = userEvent.setup()
    const quota = screen.getByRole('spinbutton', {
      name: 'Fixed check-in reward (USD)',
    })
    await user.clear(quota)
    await user.type(quota, value)
    await user.click(
      screen.getByRole('button', { name: 'Save check-in settings' })
    )
    expect(put).not.toHaveBeenCalled()
  }
)

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

it('allows a zero USD threshold without changing the existing reward', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  render(<Fixture />)
  const user = userEvent.setup()
  const threshold = screen.getByRole('spinbutton', {
    name: 'Check-in balance threshold (USD)',
  })
  await user.clear(threshold)
  await user.type(threshold, '0')
  await user.click(
    screen.getByRole('button', { name: 'Save check-in settings' })
  )
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
  expect(put).toHaveBeenCalledWith('/api/option/', {
    key: 'checkin_setting.balance_threshold',
    value: '0',
  })
})
