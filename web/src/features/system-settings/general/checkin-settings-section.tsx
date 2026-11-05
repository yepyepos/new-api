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
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type Values = {
  enabled: boolean
  minQuota: number
  maxQuota: number
  quota: number
  thresholdEnabled: boolean
  balanceThreshold: number
  timezone: string
  leaderboardPublic: boolean
}

export function CheckinSettingsSection(props: { defaultValues: Values }) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const configuredQuotaPerUnit = useSystemConfigStore(
    (state) => state.config.currency.quotaPerUnit
  )
  const quotaPerUnit =
    Number.isFinite(configuredQuotaPerUnit) && configuredQuotaPerUnit > 0
      ? configuredQuotaPerUnit
      : DEFAULT_CURRENCY_CONFIG.quotaPerUnit
  const schema = z
    .object({
      enabled: z.boolean(),
      minQuota: z.coerce
        .number()
        .min(0)
        .max(Number.MAX_SAFE_INTEGER / quotaPerUnit)
        .refine(
          (value) => Number.isSafeInteger(Math.round(value * quotaPerUnit)),
          t('Please enter a valid number')
        ),
      maxQuota: z.coerce
        .number()
        .min(0)
        .max(Number.MAX_SAFE_INTEGER / quotaPerUnit)
        .refine(
          (value) => Number.isSafeInteger(Math.round(value * quotaPerUnit)),
          t('Please enter a valid number')
        ),
      quota: z.coerce
        .number()
        .min(1 / quotaPerUnit)
        .max(Number.MAX_SAFE_INTEGER / quotaPerUnit)
        .refine(
          (value) => Number.isSafeInteger(Math.round(value * quotaPerUnit)),
          t('Please enter a valid number')
        ),
      thresholdEnabled: z.boolean(),
      balanceThreshold: z.coerce
        .number()
        .min(0)
        .max(Number.MAX_SAFE_INTEGER / quotaPerUnit)
        .refine(
          (value) => Number.isSafeInteger(Math.round(value * quotaPerUnit)),
          t('Please enter a valid number')
        ),
      timezone: z.string().min(1),
      leaderboardPublic: z.boolean(),
    })
    .refine(
      (values) =>
        (values.minQuota === 0) === (values.maxQuota === 0) &&
        (values.minQuota === 0 || values.maxQuota >= values.minQuota),
      {
        message: t(
          'Set both rewards to enable the range, or leave both at zero to use the fallback reward'
        ),
        path: ['maxQuota'],
      }
    )
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      ...props.defaultValues,
      minQuota: props.defaultValues.minQuota / quotaPerUnit,
      maxQuota: props.defaultValues.maxQuota / quotaPerUnit,
      quota: props.defaultValues.quota / quotaPerUnit,
      balanceThreshold: props.defaultValues.balanceThreshold / quotaPerUnit,
    },
  })
  const pending = updateOption.isPending || form.formState.isSubmitting

  async function onSubmit(values: Values) {
    // Only the editor uses USD; retain the stored quota API and untouched amounts.
    const storedValues = { ...values }
    for (const field of [
      'minQuota',
      'maxQuota',
      'quota',
      'balanceThreshold',
    ] as const) {
      storedValues[field] =
        values[field] === props.defaultValues[field] / quotaPerUnit
          ? props.defaultValues[field]
          : Math.round(values[field] * quotaPerUnit)
    }
    const keys = {
      enabled: 'enabled',
      minQuota: 'min_quota',
      maxQuota: 'max_quota',
      quota: 'quota',
      thresholdEnabled: 'threshold_enabled',
      balanceThreshold: 'balance_threshold',
      timezone: 'timezone',
      leaderboardPublic: 'public_enabled',
    } as const
    for (const field of Object.keys(keys) as (keyof Values)[]) {
      if (storedValues[field] !== props.defaultValues[field]) {
        await updateOption.mutateAsync({
          key: field === 'leaderboardPublic'
            ? 'community_leaderboard.public_enabled'
            : `checkin_setting.${keys[field]}`,
          value: String(storedValues[field]),
        })
      }
    }
    form.reset(values)
  }

  return (
    <SettingsSection title={t('Check-in Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={pending}
            isSaveDisabled={!form.formState.isDirty}
            saveLabel='Save check-in settings'
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable check-in feature')}</FormLabel>
                  <FormDescription>
                    {t(
                      'One successful check-in per site day. Unused chances do not carry over.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={pending}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='minQuota'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Minimum check-in reward (USD)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1 / quotaPerUnit}
                      max={Number.MAX_SAFE_INTEGER / quotaPerUnit}
                      step='any'
                      {...field}
                      disabled={pending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='maxQuota'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Maximum check-in reward (USD)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1 / quotaPerUnit}
                      max={Number.MAX_SAFE_INTEGER / quotaPerUnit}
                      step='any'
                      {...field}
                      disabled={pending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name='quota'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Fallback fixed check-in reward (USD)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1 / quotaPerUnit}
                    max={Number.MAX_SAFE_INTEGER / quotaPerUnit}
                    step='any'
                    {...field}
                    disabled={pending}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Used when no reward range is set. Enter USD and it is saved as internal quota units.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='timezone'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Check-in timezone')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder='Asia/Hong_Kong'
                    disabled={pending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='thresholdEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Limit check-in by balance')}</FormLabel>
                  <FormDescription>
                    {t(
                      'A balance above the threshold blocks the claim without using the daily chance.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={pending}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
          <FormField
            control={form.control}
            name='balanceThreshold'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Check-in balance threshold (USD)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    max={Number.MAX_SAFE_INTEGER / quotaPerUnit}
                    step='any'
                    {...field}
                    disabled={pending}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Enter USD. A balance equal to the threshold is eligible.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='leaderboardPublic'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Show leaderboards to users')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Lets regular users see the daily check-in and usage leaderboards. Admins can always see them.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={pending}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
