import { Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import styles from './FixadorTestesLamat.module.css'

const WA_LINK =
  'https://wa.me/553534238994?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20Fixador%20de%20Porcelanato%20Pousinox%20e%20os%20ensaios%20t%C3%A9cnicos.'

const provas = [
  {
    titulo: 'Laboratório independente',
    desc: 'Ensaios realizados pelo LAMAT/SENAI Itaúna — laboratório acreditado e independente da Pousinox.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0a3 3 0 1 0 6 0m-6 0H3m12 0h6" />
      </svg>
    ),
  },
  {
    titulo: 'Configurações 5 mm e 11 mm',
    desc: 'Aberturas avaliadas para compatibilidade com diferentes espessuras de porcelanato utilizadas em obra.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    ),
  },
  {
    titulo: 'Resistência mecânica comprovada',
    desc: 'Resultados de arrancamento que fundamentam a especificação do produto em projetos profissionais.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    titulo: 'Fachadas e revestimentos',
    desc: 'Indicado para uso profissional em fachadas externas, grandes formatos e revestimentos de alto desempenho.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2" /><line x1="8" y1="21" x2="8" y2="3" /><line x1="16" y1="21" x2="16" y2="3" /><line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
]

export default function FixadorTestesLamat() {
  return (
    <>
      <SEO
        title="Ensaios LAMAT/SENAI Itaúna — Fixador de Porcelanato Pousinox"
        description="O Fixador de Porcelanato Pousinox tem resistência mecânica comprovada por ensaios realizados pelo LAMAT/SENAI Itaúna. Indicado para fachadas, grandes formatos e revestimentos profissionais."
        path="/fixador-porcelanato/testes-lamat"
      />

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <div className={styles.breadcrumb}>
            <Link to="/fixador-porcelanato">Fixador de Porcelanato</Link>
            <span>/</span>
            <span>Ensaios LAMAT/SENAI Itaúna</span>
          </div>
          <h1 className={styles.pageTitle}>Ensaios LAMAT/SENAI Itaúna</h1>
          <p className={styles.pageSubtitle}>
            Resultados laboratoriais independentes que comprovam a resistência mecânica do
            Fixador Pousinox em configurações aplicáveis a diferentes espessuras de porcelanato.
          </p>
        </div>
      </div>

      {/* Prova técnica */}
      <section className={`section ${styles.provaSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">O que os ensaios comprovam</h2>
            <p className="section-subtitle">
              Os ensaios foram conduzidos pelo LAMAT/SENAI Itaúna, laboratório independente,
              com metodologia documentada e resultados que fundamentam a especificação do
              produto em projetos técnicos.
            </p>
          </div>
          <div className={styles.provaGrid}>
            {provas.map(p => (
              <div key={p.titulo} className={styles.provaCard}>
                <div className={styles.provaIcon}>{p.icon}</div>
                <h3 className={styles.provaTitulo}>{p.titulo}</h3>
                <p className={styles.provaDesc}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Relatório comercial */}
      <section className={`section ${styles.relatorioSection}`}>
        <div className="container">
          <div className={styles.relatorioInner}>
            <div className={styles.relatorioTexto}>
              <span className={styles.eyebrow}>Documentação técnica</span>
              <h2 className="section-title">Relatório técnico completo</h2>
              <p>
                O relatório técnico completo LAMAT/SENAI Itaúna acompanha negócio fechado
                e é disponibilizado em contexto técnico-comercial apropriado.
              </p>
              <p>
                Empreiteiras, construtoras, engenheiros e arquitetos que especificam o
                Fixador Pousinox recebem o relatório junto ao pedido, como suporte técnico
                para laudos, memoriais descritivos e projetos executivos.
              </p>
              <div className={styles.relatorioItens}>
                {[
                  'Relatório emitido por laboratório acreditado e independente',
                  'Disponibilizado após negócio fechado, como suporte técnico',
                  'Útil para composição de memoriais descritivos e laudos',
                  'Entregue de forma segura e personalizada por cliente',
                ].map(item => (
                  <div key={item} className={styles.relatorioItem}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.relatorioCta}>
              <div className={styles.relatorioBox}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.relatorioIcon}>
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <h3 className={styles.relatorioBoxTitulo}>
                  Acesso ao relatório LAMAT/SENAI Itaúna
                </h3>
                <p className={styles.relatorioBoxDesc}>
                  O relatório completo acompanha o negócio fechado. Solicite orçamento
                  ou fale com nossa equipe para iniciar o processo.
                </p>
                <Link to="/fixador-porcelanato/orcamento" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Solicitar Orçamento
                </Link>
                <a
                  href={WA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                  style={{ width: '100%', justifyContent: 'center' }}
                  data-source="fixador-lamat"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Falar com especialista
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Links relacionados */}
      <section className={`section ${styles.linksSection}`}>
        <div className="container">
          <div className={styles.linksGrid}>
            <Link to="/fixador-porcelanato/fachadas" className={styles.linkCard}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="18" rx="2" /><line x1="8" y1="21" x2="8" y2="3" /><line x1="16" y1="21" x2="16" y2="3" />
              </svg>
              Aplicações em fachadas e grandes formatos
            </Link>
            <Link to="/fixador-porcelanato/normas" className={styles.linkCard}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Normas técnicas ABNT para especificação
            </Link>
            <Link to="/fixador-porcelanato" className={styles.linkCard}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Visão geral do produto e especificações técnicas
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
