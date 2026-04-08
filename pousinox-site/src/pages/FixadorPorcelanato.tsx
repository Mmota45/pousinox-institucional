import { useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import fachadaPousinox from '../assets/fachada-pousinox.webp'
import SEO from '../components/SEO/SEO'
import styles from './FixadorPorcelanato.module.css'

const PRODUCT_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Fixador de Porcelanato em Aço Inox',
  description: 'Sistema de ancoragem mecânica em aço inoxidável para fixação complementar de porcelanatos, cerâmicas e revestimentos de grande formato em paredes e fachadas. Resistência comprovada por ensaios LAMAT/SENAI Itaúna.',
  url: 'https://pousinox.com.br/fixador-porcelanato',
  image: 'https://pousinox.com.br/fixador-porcelanato.png',
  brand: {
    '@type': 'Brand',
    name: 'Pousinox',
  },
  manufacturer: {
    '@type': 'Organization',
    name: 'POUSINOX® — A Arte em Inox',
    url: 'https://pousinox.com.br',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Pouso Alegre',
      addressRegion: 'MG',
      addressCountry: 'BR',
    },
  },
  material: 'Aço Inoxidável de alta liga',
  category: 'Fixadores e Ancoragens para Revestimentos',
  additionalProperty: [
    { '@type': 'PropertyValue', name: 'Espessura', value: '0,8 mm' },
    { '@type': 'PropertyValue', name: 'Comprimento', value: '120 mm' },
    { '@type': 'PropertyValue', name: 'Largura', value: '40 mm' },
    { '@type': 'PropertyValue', name: 'Sistema de Fixação', value: 'Bucha Prego 6 × 38 mm' },
    { '@type': 'PropertyValue', name: 'Normas de Referência', value: 'ABNT NBR 13754 / NBR 14081' },
    { '@type': 'PropertyValue', name: 'Ensaios', value: 'LAMAT/SENAI Itaúna' },
  ],
  offers: {
    '@type': 'Offer',
    url: 'https://pousinox.com.br/fixador-porcelanato/orcamento',
    availability: 'https://schema.org/InStock',
    seller: {
      '@type': 'Organization',
      name: 'POUSINOX®',
    },
    areaServed: 'BR',
  },
}

const WA_LINK =
  'https://wa.me/553534238994?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20Fixador%20de%20Porcelanato%20Pousinox.%20Pode%20me%20ajudar%3F'

const stats = [
  { value: '25+', label: 'Anos fabricando em aço inox' },
  { value: 'LAMAT', label: 'Resistência comprovada por laboratório independente' },
  { value: '100%', label: 'Fabricação própria — Pouso Alegre MG' },
]

const aplicacoes = [
  {
    title: 'Fachadas Externas',
    desc: 'Revestimentos expostos a chuva, vento e variação térmica acentuada. O fixador garante ancoragem mesmo com a dilatação e contração cíclica das placas.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2" /><line x1="8" y1="21" x2="8" y2="3" /><line x1="16" y1="21" x2="16" y2="3" /><line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    title: 'Grandes Formatos',
    desc: 'Placas 60×60 cm em diante concentram peso significativo. A ancoragem mecânica distribui a carga e elimina o risco de desprendimento brusco.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
      </svg>
    ),
  },
  {
    title: 'Áreas Externas e Varandas',
    desc: 'Umidade constante, limpeza periódica com produtos químicos e exposição ao tempo. O aço inoxidável não corrói nem mancha em ambiente externo.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" />
      </svg>
    ),
  },
]

const comoPassos = [
  {
    num: '01',
    titulo: 'Incisão na borda',
    desc: 'Ferramenta específica faz o rasgo na borda da placa antes da colagem. Processo rápido, feito diretamente em obra.',
  },
  {
    num: '02',
    titulo: 'Encaixe do fixador',
    desc: 'A peça metálica encaixa no rasgo e abraça a borda da placa, posicionada para ancoragem na parede.',
  },
  {
    num: '03',
    titulo: 'Ancoragem na alvenaria',
    desc: 'A aba externa é fixada na alvenaria com bucha prego 6×38 mm. A placa fica mecanicamente travada, independente da argamassa.',
  },
]

const compat = [
  {
    label: 'Abertura 5 mm',
    desc: 'Compatível com placas de 5 a 8 mm de espessura — porcelanatos e cerâmicas convencionais.',
  },
  {
    label: 'Abertura 11 mm',
    desc: 'Compatível com placas de 9 a 14 mm — grandes formatos e porcelanatos mais espessos.',
  },
  {
    label: 'Qualquer formato',
    desc: 'Da placa 30×30 cm até grandes formatos 120×160 cm e padrões acima.',
  },
  {
    label: 'Qualquer substrato',
    desc: 'Funciona em alvenaria, concreto e bases adequadas. Sem restrição de substrato.',
  },
]

const empreiteiras = [
  {
    title: 'Documentação técnica completa',
    desc: 'Relatório LAMAT/SENAI Itaúna e ficha técnica para composição de memorial descritivo, laudos e projetos executivos.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    title: 'Produção sob demanda',
    desc: 'Fabricação própria em Pouso Alegre, MG. Atendemos desde obras pontuais até grandes volumes com prazo definido por projeto.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    title: 'Entrega para todo o Brasil',
    desc: 'Despachamos direto da fábrica para qualquer estado. Sem intermediários — preço de fabricante e atendimento técnico direto.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    title: 'Suporte técnico especializado',
    desc: 'Nossa equipe auxilia na especificação, define o modelo adequado para cada projeto e oferece suporte a dúvidas técnicas durante a obra.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

const faqs = [
  {
    q: 'O fixador substitui a argamassa?',
    a: 'Não. O fixador é uma ancoragem complementar — sempre utilizado junto com argamassa AC-III. Ele atua como segunda linha de retenção: caso a argamassa perca aderência ao longo do tempo, o fixador mantém a placa no lugar.',
  },
  {
    q: 'O uso é recomendado por norma?',
    a: 'A NBR 13755 reconhece que fachadas cerâmicas exigem atenção especial à aderência e recomenda ancoragem mecânica, especialmente acima de 2,5 m de altura e para grandes formatos. Em projetos que exigem laudo técnico, a ancoragem mecânica é considerada boa prática de engenharia.',
  },
  {
    q: 'Qualquer instalador consegue aplicar?',
    a: 'Sim. O processo exige apenas a ferramenta de incisão e bucha prego convencional. Qualquer profissional com experiência em revestimentos executa com facilidade, sem necessidade de treinamento específico.',
  },
  {
    q: 'Qual a diferença entre abertura 5 mm e 11 mm?',
    a: 'As aberturas correspondem à espessura da placa cerâmica. A abertura 5 mm é indicada para placas entre 5 e 8 mm; a abertura 11 mm para placas de 9 a 14 mm. Ambas as configurações foram avaliadas nos ensaios LAMAT/SENAI Itaúna.',
  },
  {
    q: 'O fixador aparece após a instalação?',
    a: 'Não. O fixador fica completamente oculto após a instalação. A aba de ancoragem fica coberta pela argamassa e pelo rejuntamento, sem interferir na estética final do revestimento.',
  },
  {
    q: 'Como solicitar volume para uma grande obra?',
    a: 'Entre em contato pelo formulário de orçamento ou WhatsApp informando a quantidade estimada de m² de revestimento. Com fabricação própria, conseguimos planejar volumes expressivos com prazo acordado para cada projeto.',
  },
]

const subpages = [
  {
    href: '/fixador-porcelanato/fachadas',
    title: 'Fachadas e Grandes Formatos',
    desc: 'Aplicações em fachadas externas, revestimentos especiais e grandes formatos cerâmicos.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2" /><line x1="8" y1="21" x2="8" y2="3" /><line x1="16" y1="21" x2="16" y2="3" /><line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    href: '/fixador-porcelanato/ensaios',
    title: 'Ensaios LAMAT/SENAI Itaúna',
    desc: 'Resistência mecânica comprovada por laboratório independente em configurações aplicáveis a diferentes espessuras de porcelanato.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: '/fixador-porcelanato/normas',
    title: 'Normas Técnicas',
    desc: 'NBR 13754, NBR 13755 e NBR 15575 — referências para especificação técnica em projetos.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    href: '/fixador-porcelanato/orcamento',
    title: 'Solicitar Orçamento',
    desc: 'Formulário de orçamento para construtoras, empreiteiras e especificadores de todo o Brasil.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
]

export default function FixadorPorcelanato() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  return (
    <>
      <SEO
        title="Fixador de Porcelanato em Aço Inox — Linha Especializada Pousinox"
        description="Fixador mecânico de porcelanato em aço inoxidável, fabricado pela Pousinox em Pouso Alegre, MG. Resistência comprovada por ensaios LAMAT/SENAI Itaúna. Ancoragem complementar para fachadas, grandes formatos e revestimentos especiais."
        path="/fixador-porcelanato"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(PRODUCT_SCHEMA)}
        </script>
      </Helmet>

      {/* Hero */}
      <section
        className={styles.hero}
        style={{ backgroundImage: `url(${fachadaPousinox})` }}
      >
        <div className={styles.heroOverlay} />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <span className={styles.heroEyebrow}>Linha especializada · Pousinox</span>
            <h1 className={styles.heroTitle}>
              Fixador de<br />Porcelanato<br />
              <span className={styles.heroHighlight}>em Aço Inox</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Ancoragem mecânica complementar para instalação segura de porcelanatos,
              cerâmicas e revestimentos de grande formato em paredes e fachadas.
              Para empreiteiras, construtoras e especificadores em todo o Brasil.
            </p>
            <div className={styles.heroCta}>
              <Link to="/fixador-porcelanato/orcamento" className="btn-primary">
                Solicitar Orçamento
              </Link>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
                data-source="fixador-hero"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className={styles.statsStrip}>
        <div className="container">
          <div className={styles.statsGrid}>
            {stats.map(s => (
              <div key={s.label} className={styles.statItem}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Intro */}
      <section className={`section ${styles.introSection}`}>
        <div className="container">
          <div className={styles.introGrid}>
            <div className={styles.introTexto}>
              <span className={styles.eyebrow}>Por que usar ancoragem mecânica?</span>
              <h2 className="section-title">
                A argamassa sozinha não é suficiente
              </h2>
              <p>
                Porcelanatos de grande formato, fachadas externas e revestimentos sujeitos a
                variações térmicas e vibração sofrem com a fadiga da argamassa ao longo do tempo.
                Quando a aderência cede, a queda é abrupta — e pode causar acidentes graves.
              </p>
              <p>
                O Fixador de Porcelanato Pousinox atua como ancoragem mecânica complementar:
                mesmo que a argamassa perca aderência, o fixador mantém a placa no lugar,
                eliminando o risco de desprendimento.
              </p>
              <div className={styles.introBullets}>
                {[
                  'Ancoragem independente da argamassa',
                  'Aço inoxidável de alta liga — sem oxidação em ambiente externo',
                  'Compatível com qualquer argamassa colante',
                  'Invisível após a instalação',
                ].map(item => (
                  <div key={item} className={styles.introBullet}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.introImagem}>
              <img
                src="/fixador-porcelanato.png"
                alt="Fixador de Porcelanato em Aço Inox — Pousinox"
                className={styles.produtoImg}
                loading="lazy"
              />
              <div className={styles.introImageCaption}>
                Fixador Pousinox — Aço Inoxidável
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Aplicações principais */}
      <section className={`section ${styles.aplicacoesSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Para quem é indicado</span>
            <h2 className="section-title">Principais aplicações</h2>
            <p className="section-subtitle">
              O fixador Pousinox é indicado onde a argamassa sozinha não oferece segurança
              suficiente para toda a vida útil do revestimento.
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
          <div className={styles.aplicacoesCta}>
            <Link to="/fixador-porcelanato/fachadas" className={styles.aplicacoesLink}>
              Ver todas as aplicações em fachadas e grandes formatos
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className={`section ${styles.comoSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Processo de instalação</span>
            <h2 className="section-title">Como funciona em 3 etapas</h2>
            <p className="section-subtitle">
              Processo simples executado em obra por qualquer instalador profissional
              com experiência em revestimentos.
            </p>
          </div>
          <div className={styles.comoFlow}>
            {comoPassos.map((p, i) => (
              <Fragment key={p.num}>
                <div className={styles.comoPasso}>
                  <div className={styles.comoPassoNum}>{p.num}</div>
                  <h3 className={styles.comoPassoTitulo}>{p.titulo}</h3>
                  <p className={styles.comoPassoDesc}>{p.desc}</p>
                </div>
                {i < comoPassos.length - 1 && (
                  <div className={styles.comoArrow} aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Compatibilidade */}
      <section className={`section ${styles.compatSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Compatibilidade</span>
            <h2 className="section-title">Espessuras e formatos compatíveis</h2>
            <p className="section-subtitle">
              O fixador está disponível em duas aberturas para atender diferentes
              espessuras de placa. Ambas foram avaliadas nos ensaios LAMAT/SENAI Itaúna.
            </p>
          </div>
          <div className={styles.compatGrid}>
            {compat.map(c => (
              <div key={c.label} className={styles.compatCard}>
                <div className={styles.compatLabel}>{c.label}</div>
                <p className={styles.compatDesc}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ensaios LAMAT — teaser */}
      <section className={`section ${styles.lamatSection}`}>
        <div className="container">
          <div className={styles.lamatInner}>
            <div className={styles.lamatTexto}>
              <span className={styles.eyebrowLight}>Prova técnica independente</span>
              <h2 className={styles.lamatTitle}>
                Resistência mecânica comprovada pelo{' '}
                <strong>LAMAT/SENAI Itaúna</strong>
              </h2>
              <p className={styles.lamatDesc}>
                O Fixador Pousinox foi submetido a ensaios de resistência mecânica pelo
                LAMAT/SENAI Itaúna, laboratório independente. Os ensaios avaliaram diferentes
                configurações de abertura — compatíveis com diversas espessuras de porcelanato
                — e comprovam a eficácia do produto em aplicações profissionais de fachada
                e revestimento.
              </p>
              <div className={styles.lamatBullets}>
                {[
                  'Ensaios realizados por laboratório independente',
                  'Configurações avaliadas: aberturas de 5 mm e 11 mm',
                  'Indicado para fachadas e revestimentos profissionais',
                  'Relatório técnico completo disponível após negócio fechado',
                ].map(item => (
                  <div key={item} className={styles.lamatBullet}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Link to="/fixador-porcelanato/ensaios" className={styles.lamatLink}>
                Saiba mais sobre os ensaios
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios para empreiteiras */}
      <section className={`section ${styles.empreiteirasSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Para construtoras e empreiteiras</span>
            <h2 className="section-title">Por que especificar o Fixador Pousinox?</h2>
            <p className="section-subtitle">
              Além da segurança técnica, oferecemos a infraestrutura comercial que
              grandes obras precisam para especificar com confiança.
            </p>
          </div>
          <div className={styles.empreiteirasGrid}>
            {empreiteiras.map(e => (
              <div key={e.title} className={styles.empreiteirasCard}>
                <div className={styles.empreiteirasIcon}>{e.icon}</div>
                <h3 className={styles.empreiteirasTitle}>{e.title}</h3>
                <p className={styles.empreiteirasDesc}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={`section ${styles.faqSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Dúvidas frequentes</span>
            <h2 className="section-title">Perguntas mais comuns</h2>
          </div>
          <div className={styles.faqList}>
            {faqs.map((f, i) => (
              <div key={i} className={styles.faqItem}>
                <button
                  className={styles.faqQuestion}
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  aria-expanded={faqOpen === i}
                >
                  <span>{f.q}</span>
                  <svg
                    className={`${styles.faqChevron} ${faqOpen === i ? styles.faqChevronOpen : ''}`}
                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {faqOpen === i && (
                  <div className={styles.faqAnswer}>{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subpages nav */}
      <section className={`section ${styles.subpagesSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Conteúdo técnico da linha de fixadores</h2>
            <p className="section-subtitle">
              Informações detalhadas para engenheiros, arquitetos, empreiteiras e especificadores.
            </p>
          </div>
          <div className={styles.subpagesGrid}>
            {subpages.map(sp => (
              <Link key={sp.href} to={sp.href} className={styles.subpageCard}>
                <div className={styles.subpageIcon}>{sp.icon}</div>
                <h3 className={styles.subpageTitle}>{sp.title}</h3>
                <p className={styles.subpageDesc}>{sp.desc}</p>
                <span className={styles.subpageArrow}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitle}>
              Especifique o Fixador Pousinox no seu próximo projeto
            </h2>
            <p className={styles.ctaSubtitle}>
              Atendemos construtoras, empreiteiras e instaladores em todo o Brasil.
              Solicite orçamento ou fale diretamente com nossa equipe técnica.
            </p>
            <div className={styles.ctaActions}>
              <Link to="/fixador-porcelanato/orcamento" className="btn-primary">
                Solicitar Orçamento
              </Link>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-whatsapp"
                data-source="fixador-cta"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
