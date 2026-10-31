import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Flower2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconDiscord } from '@/assets/brand-icons'
import { Footer } from '@/components/layout/components/footer'
import { Button } from '@/components/ui/button'
import { useSystemConfig } from '@/hooks/use-system-config'

import '../../auth/prototype/nailong-prototype.css'
import './nailong-home-prototype.css'

// Shared artwork and navigation for the approved preview and the live home.
export function NailongHome(props: {
  preview?: boolean
  isAuthenticated?: boolean
}) {
  const { t } = useTranslation()
  const { logo, systemName } = useSystemConfig()
  const homePath = props.preview ? '/prototype/nailong-home' : '/'
  let entryPath: '/prototype/nailong' | '/sign-in' | '/dashboard' = '/sign-in'
  if (props.preview) entryPath = '/prototype/nailong'
  else if (props.isAuthenticated) entryPath = '/dashboard'

  return (
    <div className='nailong-preview nailong-landing'>
      <header className='nailong-header nailong-landing-header'>
        <Link to={homePath} className='nailong-brand'>
          <img src={logo} alt='' />
          <span>
            <strong>{systemName}</strong>
            <small>{t("Nailong's little hideaway")}</small>
          </span>
        </Link>
        <nav className='nailong-landing-nav' aria-label={t('Main navigation')}>
          <Link to={homePath} aria-current='page'>
            {t('Home')}
          </Link>
          <a href='#nailong-discover'>{t('Explore the hideaway')}</a>
          <a
            href={props.preview ? 'http://localhost:3000/pricing' : '/pricing'}
          >
            {t('Models')}
          </a>
        </nav>
        <Button
          role='link'
          className='nailong-landing-signin'
          render={<Link to={entryPath} />}
        >
          <IconDiscord aria-hidden='true' />
          {props.isAuthenticated ? t('Dashboard') : t('Sign in')}
          <ArrowUpRight aria-hidden='true' />
        </Button>
      </header>

      <main>
        <section
          className='nailong-landing-hero'
          aria-labelledby='nailong-home-title'
        >
          <div className='nailong-landing-copy'>
            <p className='nailong-landing-eyebrow'>
              <span />
              {t('A sunny little corner')}
              <span className='nailong-edition'>VOL. 01 / NAILONG</span>
            </p>
            <h1 id='nailong-home-title'>
              {t('A pocket full of ideas.')}
              <br />
              <em>{t('A little world to grow them.')}</em>
            </h1>
            <p className='nailong-landing-subtitle'>
              {t('A little sunshine for every idea.')}
            </p>
            <p className='nailong-landing-description'>
              {t(
                'Meet your community, explore AI, and make something wonderful with Nailong by your side.'
              )}
            </p>
            <div className='nailong-landing-actions'>
              <Button
                role='link'
                className='nailong-landing-primary'
                render={<Link to={entryPath} />}
              >
                <IconDiscord aria-hidden='true' />
                {t('Enter the hideaway')}
                <ArrowRight aria-hidden='true' />
              </Button>
              <Button
                role='link'
                variant='outline'
                className='nailong-landing-secondary'
                render={
                  <a
                    href='https://docs.newapi.ai/'
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                <BookOpen aria-hidden='true' />
                {t('Docs')}
                <ArrowUpRight aria-hidden='true' />
              </Button>
            </div>
            <div className='nailong-landing-note'>
              <ShieldCheck aria-hidden='true' />
              <span>{t('Community access is verified at sign-in.')}</span>
            </div>
          </div>
          <div className='nailong-landing-postcard'>
            <Flower2 aria-hidden='true' />
            <span>{t('Bring your ideas. Leave the worries outside.')}</span>
            <small>WITH LOVE, NAILONG</small>
          </div>
          <a className='nailong-landing-scroll' href='#nailong-discover'>
            <ArrowDown aria-hidden='true' />
            {t('Discover a little more')}
          </a>
          <span className='nailong-landing-coordinate' aria-hidden='true'>
            SUNSHINE / IDEAS / LITTLE JOYS
          </span>
        </section>

        <section
          id='nailong-discover'
          className='nailong-landing-discover'
          aria-labelledby='nailong-discover-title'
        >
          <div className='nailong-discover-heading'>
            <div>
              <p className='nailong-landing-eyebrow'>
                {t('A little more about us')}
              </p>
              <h2 id='nailong-discover-title'>
                {t('Small steps. Wonderful possibilities.')}
              </h2>
            </div>
            <Flower2 aria-hidden='true' />
          </div>
          <div className='nailong-landing-features'>
            <article>
              <div className='nailong-feature-top'>
                <Sparkles aria-hidden='true' />
                <span>01 / {t('Explore ideas')}</span>
              </div>
              <h3>{t('A home for your ideas')}</h3>
              <p>
                {t(
                  'Explore the model catalog and find a starting point for your next project.'
                )}
              </p>
              <a
                href={
                  props.preview ? 'http://localhost:3000/pricing' : '/pricing'
                }
              >
                {t('Models')}
                <ArrowUpRight aria-hidden='true' />
              </a>
            </article>
            <article>
              <div className='nailong-feature-top'>
                <IconDiscord aria-hidden='true' />
                <span>02 / {t('Connect with the community')}</span>
              </div>
              <h3>{t('A community, not just a gateway')}</h3>
              <p>
                {t(
                  'Bring your Discord identity along. Community membership and roles determine access.'
                )}
              </p>
              <Link to={entryPath}>
                {t('Your ticket to the community')}
                <ArrowUpRight aria-hidden='true' />
              </Link>
            </article>
            <article>
              <div className='nailong-feature-top'>
                <BookOpen aria-hidden='true' />
                <span>03 / {t('Create something new')}</span>
              </div>
              <h3>{t('Start with a little curiosity')}</h3>
              <p>
                {t(
                  'Follow the connection guide, then bring your first idea to life.'
                )}
              </p>
              <a
                href='https://docs.newapi.ai/'
                target='_blank'
                rel='noopener noreferrer'
              >
                {t('Docs')}
                <ArrowUpRight aria-hidden='true' />
              </a>
            </article>
          </div>
          {props.preview && (
            <div className='nailong-landing-preview-note'>
              <Sparkles aria-hidden='true' />
              {t('Design preview — your account and settings are unchanged.')}
            </div>
          )}
        </section>
      </main>

      {props.preview ? (
        <footer className='nailong-footer nailong-landing-footer'>
          <span>New API · QuantumNous</span>
          <span>{t('Design preview')} · NAILONG EDITION</span>
        </footer>
      ) : (
        <Footer className='bg-[#fffdf5]/90' />
      )}
    </div>
  )
}

export function NailongHomePrototype() {
  return <NailongHome preview />
}
