import { Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import styles from './CorteLaser.module.css'

const WA_LINK = 'https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20um%20orçamento%20de%20corte%20a%20laser.'

const materiais = [
  {
    nome: 'Aço Inox',
    detalhe: 'AISI 304, 430 e 316 — as três principais ligas inox para uso alimentício, arquitetônico e industrial.',
  },
  {
    nome: 'Aço Carbono',
    detalhe: 'Corte limpo e preciso para estruturas, peças e componentes industriais.',
  },
  {
    nome: 'Ligas de Alumínio',
    detalhe: 'Leveza e boa acabamento em perfis, painéis e peças decorativas.',
  },
  {
    nome: 'Outros tipos de aço',
    detalhe: 'Aço galvanizado, aço-corten e demais chapas metálicas planas.',
  },
]

const industrias = [
  'Fabricação de eletrodomésticos',
  'Utensílios de cozinha e louças sanitárias',
  'Gabinetes e equipamentos de informática',
  'Indústria de elevadores',
  'Publicidade e comunicação visual',
  'Setor automotivo e aeroespacial',
  'Produção de máquinas e equipamentos',
]

const aplicacoes = [
  {
    title: 'Chapas e Perfis',
    desc: 'Corte de chapas metálicas em qualquer espessura com precisão milimétrica e bordas sem rebarbas.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
      </svg>
    ),
  },
  {
    title: 'Peças Decorativas',
    desc: 'Painéis, biombos, revestimentos e elementos de design para arquitetura e interiores.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    title: 'Letras e Logos',
    desc: 'Letreiros, logotipos e identificação visual em metal para fachadas e ambientes comerciais.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
      </svg>
    ),
  },
  {
    title: 'Recortes Artísticos',
    desc: 'Geometrias, formas orgânicas e padrões repetitivos de qualquer complexidade.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    title: 'Componentes Industriais',
    desc: 'Peças técnicas, flanges, suportes e componentes para equipamentos sob medida.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 17.66l-1.41 1.41M20 12h-2M6 12H4M19.07 19.07l-1.41-1.41M5.34 6.34L3.93 4.93M12 20v-2M12 6V4"/>
      </svg>
    ),
  },
  {
    title: 'Protótipos Rápidos',
    desc: 'Da ideia ao protótipo metálico com agilidade, sem necessidade de ferramental especial.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
]

const vantagens = [
  { title: 'Precisão milimétrica', text: 'Tolerância de décimos de milímetro em qualquer geometria — simples ou complexa.' },
  { title: 'Sem deformação', text: 'Corte sem contato mecânico: o material não sofre stress, empenamento ou marcas.' },
  { title: 'Bordas limpas', text: 'Acabamento direto da máquina, sem rebarbas e sem necessidade de retrabalho.' },
  { title: 'Qualquer geometria', text: 'Curvas, furos, padrões repetitivos e formas livres executados com a mesma precisão.' },
]

export default function CorteLaser() {
  return (
    <>
      <SEO
        title="Corte a Laser em Chapas Metálicas — POUSINOX® Pouso Alegre, MG"
        description="Serviço de corte a laser de aço inox (304/430/316), aço carbono e alumínio em Pouso Alegre, MG. Precisão milimétrica para chapas, letras, logos e peças sob medida. Atendemos Sul de Minas e todo o Brasil."
        path="/servicos/corte-laser"
      />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <span className={styles.heroEyebrow}>Serviço especializado</span>
            <h1 className={styles.heroTitle}>Corte a Laser<br />em Chapas Metálicas</h1>
            <p className={styles.heroSubtitle}>
              Aço inox, aço carbono, ligas de alumínio e outros metais —
              precisão milimétrica para chapas, peças decorativas, letras, logos
              e qualquer recorte personalizado.
            </p>
            <div className={styles.heroCta}>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Solicitar Orçamento
              </a>
              <Link to="/contato" className={`btn-outline ${styles.btnOutlineHero}`}>
                Formulário de Orçamento
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Aplicações */}
      <section className={`section ${styles.aplicacoesSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">O que cortamos a laser</h2>
            <p className="section-subtitle">
              Da chapa industrial à peça artística — o corte a laser permite executar
              qualquer geometria com precisão e acabamento superior.
            </p>
          </div>
          <div className={styles.aplicacoesGrid}>
            {aplicacoes.map(a => (
              <div key={a.title} className={styles.aplicacaoCard}>
                <div className={styles.aplicacaoIcon}>{a.icon}</div>
                <h3 className={styles.aplicacaoTitle}>{a.title}</h3>
                <p className={styles.aplicacaoDesc}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Materiais */}
      <section className={`section ${styles.materiaisSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Materiais que cortamos</h2>
            <p className="section-subtitle">
              Nossa máquina 3015G foi desenvolvida para o corte de chapas metálicas de diferentes ligas e composições.
            </p>
          </div>
          <div className={styles.materiaisGrid}>
            {materiais.map(m => (
              <div key={m.nome} className={styles.materialCard}>
                <h3 className={styles.materialNome}>{m.nome}</h3>
                <p className={styles.materialDetalhe}>{m.detalhe}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Indústrias */}
      <section className={`section ${styles.industriasSection}`}>
        <div className="container">
          <div className={styles.industriasInner}>
            <div className={styles.industriasTexto}>
              <span className={styles.eyebrow}>Aplicações industriais</span>
              <h2 className="section-title">Indústrias atendidas</h2>
              <p className={styles.industriasIntro}>
                A tecnologia de corte a laser é amplamente utilizada em diferentes setores industriais que exigem precisão e versatilidade no processamento de chapas metálicas.
              </p>
            </div>
            <ul className={styles.industriasList}>
              {industrias.map(ind => (
                <li key={ind} className={styles.industriasItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {ind}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Vantagens */}
      <section className={`section ${styles.vantagensSection}`}>
        <div className="container">
          <div className={styles.vantagensGrid}>
            <div className={styles.vantagensTexto}>
              <span className={styles.eyebrow}>Por que corte a laser?</span>
              <h2 className="section-title">Tecnologia que faz diferença</h2>
              <p className={styles.vantagensIntro}>
                O corte a laser combina precisão, velocidade e flexibilidade que processos
                convencionais não atingem. Ideal para peças únicas ou séries, em aço inox,
                aço carbono, alumínio e outros metais.
              </p>
              <div className={styles.vantagensList}>
                {vantagens.map(v => (
                  <div key={v.title} className={styles.vantagemItem}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <div>
                      <strong>{v.title}</strong>
                      <p>{v.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.vantagensVideo}>
              <iframe
                src="https://www.youtube.com/embed/MMMGnD7oXZM"
                title="Corte a Laser em Aço Inox — Pousinox"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={styles.videoFrame}
              />
            </div>
          </div>
        </div>
      </section>

    </>
  )
}
