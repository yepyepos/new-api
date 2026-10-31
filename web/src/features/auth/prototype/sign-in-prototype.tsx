import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconDiscord } from '@/assets/brand-icons'
import { Button } from '@/components/ui/button'
import { useSystemConfig } from '@/hooks/use-system-config'

import './sign-in-prototype.css'

const variants = ['A', 'B', 'C'] as const

// Three throwaway, read-only login layouts; no OAuth, credentials or mutations.
export function SignInPrototype() {
  const { t } = useTranslation()
  const { variant } = useSearch({ from: '/prototype/sign-in' })
  const navigate = useNavigate({ from: '/prototype/sign-in' })
  const { logo, systemName } = useSystemConfig()
  const [notice, setNotice] = useState(false)

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLElement)) return
      if (
        event.target.closest(
          'input, textarea, select, [contenteditable="true"]'
        )
      ) {
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const direction = event.key === 'ArrowRight' ? 1 : -1
      const next = variants[(variants.indexOf(variant) + direction + 3) % 3]
      void navigate({ search: { variant: next }, replace: true })
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [navigate, variant])

  const card = (
    <section className='design-access' aria-labelledby='design-access-title'>
      <div className='design-card-icon'>
        <IconDiscord aria-hidden='true' />
      </div>
      <p className='design-eyebrow'>DISCORD / COMMUNITY</p>
      <h2 id='design-access-title'>{t('Your community. Your access.')}</h2>
      <p className='design-card-description'>
        {t('Use Discord to verify your community membership and roles.')}
      </p>
      <Button className='design-discord' onClick={() => setNotice(true)}>
        <IconDiscord aria-hidden='true' />
        {t('Continue with Discord')}
        <ArrowUpRight aria-hidden='true' />
      </Button>
      <p className='design-safety'>
        <ShieldCheck aria-hidden='true' />
        {t('Community access is verified at sign-in.')}
      </p>
      <div className='design-notice' role='status'>
        {notice
          ? t('Visual preview only. No sign-in request was sent.')
          : t('Design preview — your account and settings are unchanged.')}
      </div>
    </section>
  )

  const headline = (
    <div className='design-story'>
      <p className='design-eyebrow'>
        <span className='design-dot' />
        {t('Built for your community')}
      </p>
      <h1>
        {t('One gateway.')}
        <br />
        <em>{t('More possibilities.')}</em>
      </h1>
      <p className='design-intro'>
        {t('A shared space for ideas, models, and everything you build next.')}
      </p>
      <div className='design-steps'>
        <span>
          <Check aria-hidden='true' />
          Discord
        </span>
        <span>
          <Check aria-hidden='true' />
          {t('Server membership')}
        </span>
        <span>
          <Check aria-hidden='true' />
          {t('Discord role IDs')}
        </span>
      </div>
    </div>
  )

  return (
    <div
      className={`design-preview design-preview-${variant}`}
      data-variant={variant}
    >
      <header className='design-header'>
        <a className='design-brand' href='http://localhost:3000/'>
          <img src={logo} alt='' />
          {systemName}
        </a>
        <span className='design-header-note'>{t('Design preview')}</span>
        <a className='design-original' href='http://localhost:3000/sign-in'>
          {t('Open original sign-in')}
          <ArrowUpRight aria-hidden='true' />
        </a>
      </header>
      <main key={variant} className='design-main'>
        {variant === 'B' && (
          <div className='design-terminal' aria-hidden='true'>
            <i />
            <i />
            <i />
            <span>new-api / community-gateway</span>
          </div>
        )}
        {headline}
        {card}
        {variant === 'C' && (
          <div className='design-orbit' aria-hidden='true'>
            <span>API</span>
            <span>AI</span>
            <span>01</span>
          </div>
        )}
      </main>
      <footer className='design-footer'>
        <span>New API · QuantumNous</span>
        <span>{t('Design preview')}</span>
      </footer>
      <nav className='design-switcher' aria-label={t('Design preview')}>
        <Button
          variant='ghost'
          size='icon'
          aria-label={t('Previous')}
          onClick={() =>
            void navigate({
              search: {
                variant: variants[(variants.indexOf(variant) + 2) % 3],
              },
              replace: true,
            })
          }
        >
          <ArrowLeft />
        </Button>
        <span aria-live='polite'>
          {t('Design preview')} <b>{variant}</b>
          <small>{variants.indexOf(variant) + 1} / 3</small>
        </span>
        <Button
          variant='ghost'
          size='icon'
          aria-label={t('Next')}
          onClick={() =>
            void navigate({
              search: {
                variant: variants[(variants.indexOf(variant) + 1) % 3],
              },
              replace: true,
            })
          }
        >
          <ArrowRight />
        </Button>
      </nav>
    </div>
  )
}
