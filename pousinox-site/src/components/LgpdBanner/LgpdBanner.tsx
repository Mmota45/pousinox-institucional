import { useState, useEffect } from 'react'
import { usePublicFlag } from '../../hooks/useFeatureFlags'
import styles from './LgpdBanner.module.css'

const STORAGE_KEY = 'pousinox_lgpd_consent'

export default function LgpdBanner() {
  const ativo = usePublicFlag('banner_lgpd')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ativo) return
    const consent = localStorage.getItem(STORAGE_KEY)
    if (!consent) setVisible(true)
  }, [ativo])

  function aceitar() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aceito: true, data: new Date().toISOString() }))
    setVisible(false)
  }

  function recusar() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ aceito: false, data: new Date().toISOString() }))
    setVisible(false)
    // Desabilita analytics
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
  }

  if (!visible) return null

  return (
    <div className={styles.banner}>
      <div className={styles.inner}>
        <div className={styles.text}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <p>
            Utilizamos cookies e tecnologias semelhantes para melhorar sua experiência, personalizar conteúdo e analisar o tráfego do site.
            Ao continuar navegando, você concorda com nossa{' '}
            <a href="/privacidade" className={styles.link}>Política de Privacidade</a>.
          </p>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnAceitar} onClick={aceitar}>Aceitar</button>
          <button className={styles.btnRecusar} onClick={recusar}>Recusar</button>
        </div>
      </div>
    </div>
  )
}
