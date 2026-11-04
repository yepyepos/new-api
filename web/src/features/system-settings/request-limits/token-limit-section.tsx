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
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

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
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const tokenLimitSchema = z.object({
  token_setting: z.object({
    max_user_tokens: z.number().min(1),
    auto_revoke_enabled: z.boolean(),
    auto_revoke_time: z
      .string()
      .refine((value) => value === '' || timePattern.test(value), {
        message: 'Use 24-hour HH:MM format',
      }),
    auto_revoke_skip_admins: z.boolean(),
    auto_revoke_exempt_user_ids: z.string(),
  }),
})

type TokenLimitFormValues = z.output<typeof tokenLimitSchema>
type TokenLimitFormInput = z.input<typeof tokenLimitSchema>

type NormalizedTokenLimitValues = {
  'token_setting.max_user_tokens': number
  'token_setting.auto_revoke_enabled': boolean
  'token_setting.auto_revoke_time': string
  'token_setting.auto_revoke_skip_admins': boolean
  'token_setting.auto_revoke_exempt_user_ids': number[]
}

type TokenLimitSectionProps = {
  defaultValues: NormalizedTokenLimitValues
}

const joinUserIds = (ids: number[]): string => ids.join(', ')

const parseUserIds = (raw: string): number[] => {
  const seen = new Set<number>()
  const result: number[] = []
  raw
    .split(/[\s,;，；]+/)
    .filter((part) => part !== '')
    .forEach((part) => {
      const parsed = Number.parseInt(part, 10)
      if (!Number.isNaN(parsed) && parsed > 0 && !seen.has(parsed)) {
        seen.add(parsed)
        result.push(parsed)
      }
    })
  return result
}

const buildFormDefaults = (
  defaults: TokenLimitSectionProps['defaultValues']
): TokenLimitFormInput => ({
  token_setting: {
    max_user_tokens: defaults['token_setting.max_user_tokens'],
    auto_revoke_enabled: defaults['token_setting.auto_revoke_enabled'],
    auto_revoke_time: defaults['token_setting.auto_revoke_time'],
    auto_revoke_skip_admins: defaults['token_setting.auto_revoke_skip_admins'],
    auto_revoke_exempt_user_ids: joinUserIds(
      defaults['token_setting.auto_revoke_exempt_user_ids']
    ),
  },
})

const sameIds = (left: number[], right: number[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

export function TokenLimitSection({ defaultValues }: TokenLimitSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<TokenLimitFormInput, unknown, TokenLimitFormValues>({
    resolver: zodResolver(tokenLimitSchema),
    mode: 'onChange',
    defaultValues: buildFormDefaults(defaultValues),
  })

  useEffect(() => {
    form.reset(buildFormDefaults(defaultValues))
  }, [defaultValues, form])

  const onSubmit = async (values: TokenLimitFormValues) => {
    const next = values.token_setting

    if (next.max_user_tokens !== defaultValues['token_setting.max_user_tokens']) {
      await updateOption.mutateAsync({
        key: 'token_setting.max_user_tokens',
        value: next.max_user_tokens,
      })
    }

    if (
      next.auto_revoke_enabled !==
      defaultValues['token_setting.auto_revoke_enabled']
    ) {
      await updateOption.mutateAsync({
        key: 'token_setting.auto_revoke_enabled',
        value: next.auto_revoke_enabled,
      })
    }

    if (
      next.auto_revoke_time !== defaultValues['token_setting.auto_revoke_time']
    ) {
      await updateOption.mutateAsync({
        key: 'token_setting.auto_revoke_time',
        value: next.auto_revoke_time,
      })
    }

    if (
      next.auto_revoke_skip_admins !==
      defaultValues['token_setting.auto_revoke_skip_admins']
    ) {
      await updateOption.mutateAsync({
        key: 'token_setting.auto_revoke_skip_admins',
        value: next.auto_revoke_skip_admins,
      })
    }

    const nextIds = parseUserIds(next.auto_revoke_exempt_user_ids)
    if (
      !sameIds(nextIds, defaultValues['token_setting.auto_revoke_exempt_user_ids'])
    ) {
      await updateOption.mutateAsync({
        key: 'token_setting.auto_revoke_exempt_user_ids',
        value: JSON.stringify(nextIds),
      })
    }
  }

  return (
    <SettingsSection title={t('Token Limits')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save token limits'
          />
          <FormField
            control={form.control}
            name='token_setting.max_user_tokens'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Maximum tokens per user')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    step={1}
                    {...field}
                    onChange={(e) =>
                      field.onChange(Number.parseInt(e.target.value) || 1)
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Maximum number of tokens each user can create. Default 1000. Setting too large may affect performance.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='token_setting.auto_revoke_enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Revoke all API keys daily')}</FormLabel>
                  <FormDescription>
                    {t(
                      'When enabled, every API key is invalidated once a day at the configured time. Users must create a new key before they can continue. This cannot be undone.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='token_setting.auto_revoke_time'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Daily revoke time')}</FormLabel>
                  <FormControl>
                    <Input type='time' step={60} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Server local time, 24-hour HH:MM. Keys are revoked once per day when the clock reaches this minute.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='token_setting.auto_revoke_exempt_user_ids'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Exempt user IDs')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g. 1, 7, 42')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Comma-separated user IDs whose keys are never revoked. Leave empty to affect everyone except the exemptions below.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='token_setting.auto_revoke_skip_admins'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Skip administrator accounts')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Administrators and the root account keep their API keys. Turn this off to include them as well.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
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
