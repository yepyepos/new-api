import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import {
  saveRegistrationBatch,
  type RegistrationBatch,
} from './registration-admission-api'

const schema = z.object({
  enabled: z.boolean(),
  limit: z.coerce.number().int().min(1).max(1000000000),
})
type Values = z.infer<typeof schema>

export function RegistrationBatchForm(props: {
  batch: RegistrationBatch
  ordinaryOpen: boolean
}) {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const [pendingReset, setPendingReset] = useState<Values | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      enabled: props.batch.enabled,
      limit: props.batch.limit || 100,
    },
  })
  const mutation = useMutation({
    mutationFn: saveRegistrationBatch,
    onSuccess: async () => {
      setPendingReset(null)
      await client.invalidateQueries({ queryKey: ['registration-admission'] })
      await client.invalidateQueries({ queryKey: ['status'] })
    },
  })
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return (
    <div className='space-y-4 rounded-xl border p-5'>
      <h4 className='font-semibold'>{t('Ordinary registration batch')}</h4>
      <p className='text-muted-foreground text-sm'>
        {t('Successful registrations in this batch')}:{' '}
        {formatNumber(props.batch.used, locale)}
        {' / '}
        {formatNumber(props.batch.limit, locale)} ·{' '}
        {props.ordinaryOpen ? t('Open') : t('Closed')}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Invitation registrations do not use batch slots. Existing accounts can still sign in. The main registration switch must be on for ordinary registration.'
        )}
      </p>
      <Form {...form}>
        <form
          className='space-y-4'
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate({ ...values, reset: false })
          )}
        >
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <FormItem className='flex items-center justify-between gap-3'>
                <FormLabel>{t('Limit ordinary registrations')}</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={mutation.isPending}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='limit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Registration slots')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={1000000000}
                    step={1}
                    {...field}
                    disabled={mutation.isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='flex flex-wrap gap-2'>
            <Button type='submit' disabled={mutation.isPending}>
              {t('Save without resetting count')}
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={mutation.isPending}
              onClick={form.handleSubmit(setPendingReset)}
            >
              {t('Start a new batch')}
            </Button>
          </div>
        </form>
      </Form>
      <ConfirmDialog
        open={pendingReset !== null}
        onOpenChange={(open) => {
          if (!open) setPendingReset(null)
        }}
        title={t('Start a new batch')}
        desc={t(
          'This resets the ordinary registration count to zero. Existing users and invitation usage are unchanged.'
        )}
        isLoading={mutation.isPending}
        handleConfirm={() => {
          if (pendingReset) mutation.mutate({ ...pendingReset, reset: true })
        }}
      />
    </div>
  )
}
