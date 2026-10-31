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
import { Link, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStatus } from '@/hooks/use-status'

import { NailongAuthLayout } from '../components/nailong-auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { t } = useTranslation()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { status } = useStatus()

  return (
    <NailongAuthLayout>
      <Tabs defaultValue='login'>
        <TabsList
          className='nailong-tabs'
          aria-label={t('Sign in and registration')}
        >
          <TabsTrigger value='login'>{t('Back to the hideaway')}</TabsTrigger>
          <TabsTrigger value='invitation'>
            {t('Get an entry ticket')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value='login' className='nailong-panel'>
          <div className='nailong-welcome'>
            <h2>{t('Welcome back!')}</h2>
            <p>{t('Your community. Your access.')}</p>
          </div>
          <UserAuthForm collapsePasswordLogin redirectTo={redirect} />
          {!status?.self_use_mode_enabled &&
            status?.register_enabled !== false &&
            status?.password_register_enabled !== false &&
            !status?.discord_only_login && (
              <Link to='/sign-up' className='nailong-admin'>
                {t('Sign up')}
              </Link>
            )}
        </TabsContent>
        <TabsContent value='invitation' className='nailong-panel'>
          <div className='nailong-welcome'>
            <h2>{t('Your ticket to the community')}</h2>
            <p>{t('Enter a registration code before creating an account.')}</p>
          </div>
          <UserAuthForm invitationRegistration redirectTo={redirect} />
        </TabsContent>
      </Tabs>
      <TermsFooter variant='sign-in' status={status} className='text-center' />
    </NailongAuthLayout>
  )
}
