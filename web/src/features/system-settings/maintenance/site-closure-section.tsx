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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'

import {
  revokeAllLoginSessions,
  setSiteClosure,
  useSiteClosure,
} from '@/features/site-closure/api'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'

// Mirrors the server-side cap so an over-long notice is reported next to the
// field instead of coming back as a failed save.
const closureNoticeMaxLength = 4000

const closureSchema = z.object({
  notice: z.string().max(closureNoticeMaxLength),
})

type ClosureFormValues = z.infer<typeof closureSchema>

/**
 * The site-wide close switch, its announcement, and the sign-everyone-out
 * action.
 *
 * The switch is an action, not a form field: closing and reopening apply the
 * moment it moves, because a closure is used in a hurry and a two-step save
 * would leave the server open after the administrator believes it is shut.
 * The notice is ordinary content and is saved with the form's button.
 */
export function SiteClosureSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { closure } = useSiteClosure()
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)

  const form = useForm<ClosureFormValues>({
    resolver: zodResolver(closureSchema),
    defaultValues: { notice: closure.notice },
  })

  useEffect(() => {
    form.reset({ notice: closure.notice })
  }, [closure.notice, form])

  const closureMutation = useMutation({
    mutationFn: setSiteClosure,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['site-closure'] })
    },
    onError: (error: Error) => {
      handleServerError(error, t('Failed to update setting'))
    },
  })

  const signOutMutation = useMutation({
    mutationFn: revokeAllLoginSessions,
    // Revoking every session includes the caller's own, so the app lands on the
    // sign-in page on the next request; there is nothing left to refresh.
  })

  const applyClosure = (closed: boolean, notice: string) => {
    closureMutation.mutate({ enabled: closed, notice })
  }

  const saveNotice = (values: ClosureFormValues) => {
    applyClosure(closure.closed, values.notice)
  }

  return (
    <SettingsSection title={t('Site Closure')} className='gap-6'>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(saveNotice)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(saveNotice)}
            onReset={() => form.reset({ notice: closure.notice })}
            isSaving={closureMutation.isPending}
            isSaveDisabled={!form.formState.isDirty}
            saveLabel='Save closure notice'
          />
          <SettingsSwitchItem>
            <SettingsSwitchContent>
              <FormLabel>{t('Close the site')}</FormLabel>
              <FormDescription>
                {t(
                  'While closed, API requests return 503, users cannot sign in, and every page shows the notice below. Administrators keep access.'
                )}
              </FormDescription>
            </SettingsSwitchContent>
            <Switch
              aria-label={t('Close the site')}
              checked={closure.closed}
              disabled={closureMutation.isPending}
              onCheckedChange={(checked) => {
                // Closing locks everyone out of the very console that reopens
                // the site, so it asks first. Reopening needs no confirmation.
                if (checked) {
                  setCloseConfirmOpen(true)
                  return
                }
                applyClosure(false, form.getValues('notice'))
              }}
            />
          </SettingsSwitchItem>
          <FormField
            control={form.control}
            name='notice'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Closure notice')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={8}
                    placeholder={t(
                      'We are performing scheduled maintenance and expect to be back shortly.'
                    )}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Markdown is supported. It is shown on the closure page and appended to the 503 message API clients receive.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>

      <Separator />

      <div className='flex min-w-0 flex-col items-start gap-3'>
        <div className='space-y-0.5'>
          <h4 className='font-medium'>{t('Sign out all users')}</h4>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Ends every dashboard session and invalidates the access tokens already issued to them. API keys keep working.'
            )}
          </p>
        </div>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => setSignOutConfirmOpen(true)}
        >
          {t('Sign out all users')}
        </Button>
      </div>

      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title={t('Close the site now?')}
        desc={t(
          'API requests stop immediately and users are locked out of the console. Administrators keep access.'
        )}
        confirmText={t('Close the site')}
        destructive
        isLoading={closureMutation.isPending}
        handleConfirm={() => {
          setCloseConfirmOpen(false)
          applyClosure(true, form.getValues('notice'))
        }}
      />

      <ConfirmDialog
        open={signOutConfirmOpen}
        onOpenChange={setSignOutConfirmOpen}
        title={t('Sign out all users?')}
        desc={t(
          'Every user, including you, will have to sign in again. API keys keep working.'
        )}
        confirmText={t('Sign out everyone')}
        destructive
        isLoading={signOutMutation.isPending}
        handleConfirm={() => {
          setSignOutConfirmOpen(false)
          signOutMutation.mutate()
        }}
      />
    </SettingsSection>
  )
}
