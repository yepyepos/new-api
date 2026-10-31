import { Link } from '@tanstack/react-router'
import { ArrowLeft, Flower2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'

import '../prototype/nailong-prototype.css'

export function NailongAuthLayout(props: { children: ReactNode }) {
  const { t } = useTranslation()
  const { logo, systemName } = useSystemConfig()
  return (
    <div className='nailong-preview nailong-auth'>
      <header className='nailong-header'>
        <Link to='/' className='nailong-brand'>
          <img src={logo} alt='' />
          <span>
            <strong>{systemName}</strong>
            <small>{t('A little sunshine for every idea.')}</small>
          </span>
        </Link>
        <Link className='nailong-home' to='/'>
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
            {t('Bring your ideas. Leave the worries outside.')}
          </div>
          {props.children}
        </section>
      </main>
      <footer className='nailong-footer'>
        <span>New API · QuantumNous</span>
        <span>NAILONG EDITION</span>
      </footer>
    </div>
  )
}
