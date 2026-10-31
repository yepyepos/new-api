import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { CopyButton } from '@/components/copy-button'
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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import { createRegistrationInvitation } from './registration-admission-api'

const schema = z
  .object({
    name: z.string().trim().min(1).max(80),
    max_uses: z.coerce.number().int().min(1).max(1000000000),
    exempt: z.boolean(),
    expires_at: z.string(),
  })
  .refine(
    (values) =>
      !values.expires_at || Date.parse(values.expires_at) > Date.now(),
    { path: ['expires_at'], message: 'Invalid expiration time' }
  )
type Values = z.infer<typeof schema>

export function RegistrationInviteForm() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [createdCode, setCreatedCode] = useState('')
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { name: '', max_uses: 1, exempt: false, expires_at: '' },
  })
  const mutation = useMutation({
    mutationFn: createRegistrationInvitation,
    onSuccess: async (data) => {
      setCreatedCode(data.code)
      await client.invalidateQueries({ queryKey: ['registration-admission'] })
    },
  })
  return (
    <div className='space-y-4 rounded-xl border p-5'>
      <h4 className='font-semibold'>{t('Create registration invitation')}</h4>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Both invitation types require Discord and bypass the ordinary registration cap. Server blacklists always apply.'
        )}
      </p>
      <Form {...form}>
        <form
          className='space-y-4'
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate({
              ...values,
              expires_at: values.expires_at
                ? Math.floor(Date.parse(values.expires_at) / 1000)
                : 0,
            })
          )}
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={80}
                    disabled={mutation.isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='max_uses'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Maximum successful registrations')}</FormLabel>
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
            <FormField
              control={form.control}
              name='expires_at'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Expiration time (optional)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='datetime-local'
                      {...field}
                      disabled={mutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name='exempt'
            render={({ field }) => (
              <FormItem className='flex items-start justify-between gap-4'>
                <div className='space-y-2'>
                  <FormLabel>
                    {t('Exempt from community requirements')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Skip required server and role checks at registration and future logins. This does not bypass server blacklists or account bans.'
                    )}
                  </FormDescription>
                </div>
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
          <Button type='submit' disabled={mutation.isPending}>
            {t('Create invitation')}
          </Button>
        </form>
      </Form>
      {createdCode && (
        <div className='bg-muted space-y-2 rounded-lg p-4' role='status'>
          <p className='text-sm font-medium'>
            {t('Copy this code now. It is only shown once.')}
          </p>
          <div className='flex items-center gap-2'>
            <code className='min-w-0 flex-1 break-all'>{createdCode}</code>
            <CopyButton value={createdCode} />
          </div>
        </div>
      )}
    </div>
  )
}
