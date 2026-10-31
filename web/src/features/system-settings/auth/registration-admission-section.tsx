import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { SettingsSection } from '../components/settings-section'
import {
  disableRegistrationInvitation,
  getRegistrationAdmission,
  type RegistrationInvite,
} from './registration-admission-api'
import { RegistrationBatchForm } from './registration-batch-form'
import { RegistrationInviteForm } from './registration-invite-form'

export function RegistrationAdmissionSection() {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const [disabling, setDisabling] = useState<RegistrationInvite | null>(null)
  const query = useQuery({
    queryKey: ['registration-admission'],
    queryFn: getRegistrationAdmission,
  })
  const disable = useMutation({
    mutationFn: disableRegistrationInvitation,
    onSuccess: async () => {
      setDisabling(null)
      await client.invalidateQueries({ queryKey: ['registration-admission'] })
    },
  })
  if (query.isPending) return <LoadingState />
  if (query.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  }
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  return (
    <SettingsSection title={t('Registration admission')}>
      <RegistrationBatchForm
        key={`${query.data.batch.enabled}-${query.data.batch.limit}-${query.data.batch.used}`}
        batch={query.data.batch}
        ordinaryOpen={query.data.ordinary_open}
      />
      <RegistrationInviteForm />
      <h4 className='font-semibold'>{t('Registration invitations')}</h4>
      <p className='text-muted-foreground text-sm'>
        {t(
          'The latest 200 invitations are shown. Disabling a code prevents new registrations but does not revoke existing account exemptions.'
        )}
      </p>
      {query.data.invites.length === 0 && <EmptyState />}
      <ul className='space-y-3'>
        {query.data.invites.map((invite) => (
          <li
            key={invite.id}
            className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4'
          >
            <div className='min-w-0 space-y-1'>
              <p className='font-medium break-all'>{invite.name}</p>
              <p className='text-muted-foreground text-sm'>
                {invite.exempt
                  ? t('Community exempt')
                  : t('Normal community checks')}
                {' · '}
                {formatNumber(invite.used, locale)} /{' '}
                {formatNumber(invite.max_uses, locale)}
              </p>
              <p className='text-muted-foreground text-xs'>
                {invite.expires_at
                  ? new Date(invite.expires_at * 1000).toLocaleString(locale)
                  : t('No expiration')}
              </p>
            </div>
            <Button
              variant='outline'
              disabled={invite.disabled || disable.isPending}
              onClick={() => setDisabling(invite)}
            >
              {invite.disabled ? t('Disabled') : t('Disable')}
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={disabling !== null}
        onOpenChange={(open) => {
          if (!open) setDisabling(null)
        }}
        title={t('Disable invitation')}
        desc={t(
          'This prevents new registrations with this invitation. Existing accounts are unchanged.'
        )}
        isLoading={disable.isPending}
        handleConfirm={() => {
          if (disabling) disable.mutate(disabling.id)
        }}
      />
    </SettingsSection>
  )
}
