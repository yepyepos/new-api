import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Flower2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconDiscord } from '@/assets/brand-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSystemConfig } from '@/hooks/use-system-config'

import './nailong-prototype.css'

// Visual-only draft. Registration codes and Discord authentication are not connected.
export function NailongPrototype() {
  const { t } = useTranslation()
  const { logo, systemName } = useSystemConfig()
  const [tab, setTab] = useState('login')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState(false)

  return (
    <div className='nailong-preview'>
      <header className='nailong-header'>
        <Link to='/prototype/nailong-home' className='nailong-brand'>
          <img src={logo} alt='' />
          <span>
            <strong>{systemName}</strong>
            <small>{t('A little sunshine for every idea.')}</small>
          </span>
        </Link>
        <Link className='nailong-home' to='/prototype/nailong-home'>
          <ArrowLeft aria-hidden='true' />
          {t('Home')}
        </Link>
      </header>

      <main className='nailong-main'>
        <section className='nailong-card' aria-labelledby='nailong-title'>
          <div className='nailong-card-top'>
            <span>
              <Flower2 aria-hidden='true' />
              {t('A sunny little corner')}
            </span>
            <span>NO. 001</span>
          </div>
          <div className='nailong-heading'>
            <div>
              <p>NAILONG / COMMUNITY</p>
              <h1 id='nailong-title'>{t("Nailong's little hideaway")}</h1>
            </div>
            <div className='nailong-flower' aria-hidden='true'>
              <Flower2 />
            </div>
          </div>
          <div className='nailong-mood'>
            <span>✦</span>
            {t('Bring your ideas. Leave the worries outside.')}
            <span>✦</span>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(String(value))
              setNotice(false)
            }}
          >
            <TabsList
              className='nailong-tabs'
              aria-label={t('Sign in and registration')}
            >
              <TabsTrigger value='login'>
                {t('Back to the hideaway')}
              </TabsTrigger>
              <TabsTrigger value='register'>
                {t('Get an entry ticket')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value='login' className='nailong-panel'>
              <div className='nailong-welcome'>
                <h2>{t('Welcome back!')}</h2>
                <p>{t('Your community. Your access.')}</p>
              </div>
              <Button
                className='nailong-discord'
                onClick={() => setNotice(true)}
              >
                <IconDiscord aria-hidden='true' />
                {t('Continue with Discord')}
                <ArrowRight aria-hidden='true' />
              </Button>
              <p className='nailong-check'>
                <ShieldCheck aria-hidden='true' />
                {t(
                  'Use Discord to verify your community membership and roles.'
                )}
              </p>
              <div className='nailong-divider' />
              <div className='nailong-help'>
                <KeyRound aria-hidden='true' />
                <span>
                  {t('Already have access? Sign in with your Discord account.')}
                </span>
              </div>
              <a className='nailong-admin' href='http://localhost:3000/sign-in'>
                {t('Open original sign-in')}
                <ArrowRight aria-hidden='true' />
              </a>
            </TabsContent>

            <TabsContent value='register' className='nailong-panel'>
              <div className='nailong-welcome'>
                <h2>
                  <Ticket aria-hidden='true' />
                  {t('Your ticket to the community')}
                </h2>
                <p>
                  {t('Enter a registration code before creating an account.')}
                </p>
              </div>
              <form
                className='nailong-code-form'
                onSubmit={(event) => {
                  event.preventDefault()
                  setNotice(true)
                }}
              >
                <Label htmlFor='nailong-code'>{t('Registration code')}</Label>
                <Input
                  id='nailong-code'
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value)
                    setNotice(false)
                  }}
                  placeholder={t('Enter your registration code')}
                  autoComplete='off'
                  spellCheck={false}
                />
                <Button
                  type='submit'
                  className='nailong-discord'
                  disabled={!code.trim()}
                >
                  <Ticket aria-hidden='true' />
                  {t('Check my ticket')}
                  <ArrowRight aria-hidden='true' />
                </Button>
              </form>
              <p className='nailong-check'>
                <ShieldCheck aria-hidden='true' />
                {t(
                  'Registration-code verification is not connected in this preview.'
                )}
              </p>
            </TabsContent>
          </Tabs>

          <div className='nailong-preview-note' role='status'>
            <Sparkles aria-hidden='true' />
            <span>
              {notice
                ? t('Visual preview only. No sign-in request was sent.')
                : t(
                    'Design preview — your account and settings are unchanged.'
                  )}
            </span>
          </div>
        </section>
      </main>

      <footer className='nailong-footer'>
        <span>New API · QuantumNous</span>
        <span>{t('Design preview')} · NAILONG EDITION</span>
      </footer>
    </div>
  )
}
