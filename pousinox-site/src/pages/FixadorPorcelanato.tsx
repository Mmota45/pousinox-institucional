import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import fachadaPousinox from '../assets/fachada-pousinox.webp'
import SEO from '../components/SEO/SEO'
import SeloValidacao from '../components/SeloValidacao/SeloValidacao'
import { useSiteConfig } from '../hooks/useSiteData'
import { supabase } from '../lib/supabase'
import styles from './FixadorPorcelanato.module.css'

const PRODUCT_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Fixador de Porcelanato em Aço Inox',
  description: 'Sistema de ancoragem mecânica em aço inoxidável para fixação complementar de porcelanatos, cerâmicas e revestimentos de grande formato em paredes e fachadas. Resistência comprovada por ensaios LAMAT/SENAI.',
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
    { '@type': 'PropertyValue', name: 'Ensaios', value: 'LAMAT/SENAI' },
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
  'https://wa.me/5535999619463?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20Fixador%20de%20Porcelanato%20Pousinox.%20Pode%20me%20ajudar%3F'

const stats = [
  { value: '25+', label: 'Anos fabricando em aço inox' },
  { value: '2 formatos', label: 'Abertura 5 mm e 11 mm' },
  { value: '100%', label: 'Fabricação própria' },
]

const aplicacoes = [
  {
    title: 'Fachadas Externas',
    desc: 'Revestimentos expostos a chuva, vento e variação térmica. O fixador garante ancoragem mesmo com dilatação e contração cíclica.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2" /><line x1="8" y1="21" x2="8" y2="3" /><line x1="16" y1="21" x2="16" y2="3" /><line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    title: 'Grandes Formatos',
    desc: 'Placas 60×60 cm em diante concentram peso significativo. A ancoragem mecânica distribui a carga e elimina o risco de desprendimento.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
      </svg>
    ),
  },
  {
    title: 'Áreas Externas e Varandas',
    desc: 'Umidade constante e exposição ao tempo. O aço inoxidável não corrói nem mancha em ambiente externo.',
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
    desc: 'Ferramenta específica faz o rasgo na borda da placa antes da colagem.',
  },
  {
    num: '02',
    titulo: 'Encaixe do fixador',
    desc: 'A peça metálica encaixa no rasgo e abraça a borda da placa.',
  },
  {
    num: '03',
    titulo: 'Ancoragem na alvenaria',
    desc: 'Fixação com bucha prego 6×38 mm. A placa fica mecanicamente travada.',
  },
]

const compat = [
  {
    label: 'Abertura 5 mm',
    desc: 'Placas de 5 a 8 mm — porcelanatos e cerâmicas convencionais.',
  },
  {
    label: 'Abertura 11 mm',
    desc: 'Placas de 9 a 14 mm — grandes formatos e porcelanatos espessos.',
  },
  {
    label: 'Qualquer formato',
    desc: 'Da placa 30×30 cm até grandes formatos 120×160 cm.',
  },
  {
    label: 'Qualquer substrato',
    desc: 'Alvenaria, concreto e bases adequadas. Sem restrição.',
  },
]

const faqs = [
  {
    q: 'O fixador substitui a argamassa?',
    a: 'Não. O fixador é uma ancoragem complementar — sempre utilizado junto com argamassa AC-III. Ele atua como segunda linha de retenção: caso a argamassa perca aderência, o fixador mantém a placa no lugar.',
  },
  {
    q: 'O uso é recomendado por norma?',
    a: 'A NBR 13755 reconhece que fachadas cerâmicas exigem atenção especial à aderência e recomenda ancoragem mecânica, especialmente acima de 2,5 m de altura e para grandes formatos.',
  },
  {
    q: 'Qualquer instalador consegue aplicar?',
    a: 'Sim. O processo exige apenas a ferramenta de incisão e bucha prego convencional. Qualquer profissional com experiência em revestimentos executa com facilidade.',
  },
  {
    q: 'Qual a diferença entre abertura 5 mm e 11 mm?',
    a: 'As aberturas correspondem à espessura da placa. A abertura 5 mm é para placas entre 5 e 8 mm; a abertura 11 mm para placas de 9 a 14 mm. Ambas avaliadas nos ensaios LAMAT/SENAI.',
  },
  {
    q: 'O fixador aparece após a instalação?',
    a: 'Não. Fica completamente oculto após a instalação — coberto pela argamassa e rejuntamento.',
  },
  {
    q: 'Como solicitar volume para uma grande obra?',
    a: 'Entre em contato pelo formulário de orçamento ou WhatsApp informando a quantidade estimada de m². Com fabricação própria, planejamos volumes expressivos com prazo acordado.',
  },
]

export default function FixadorPorcelanato() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const { config } = useSiteConfig()
  const [dbFaqs, setDbFaqs] = useState<{ id: number; pergunta: string; resposta: string }[]>([])

  useEffect(() => {
    supabase.from('site_faq').select('id, pergunta, resposta').eq('ativo', true).eq('categoria', 'fixador').order('ordem')
      .then(({ data }) => { if (data?.length) setDbFaqs(data) })
  }, [])

  const c = config
  const heroTitle = c.fixador_hero_titulo || 'Fixador de Porcelanato em Aço Inox'
  const heroSub = c.fixador_hero_subtitulo || 'Ancoragem mecânica complementar para porcelanatos de grande formato, fachadas externas e revestimentos especiais. Quando a argamassa cede, o fixador mantém a placa no lugar.'
  const introTitulo = c.fixador_intro_titulo || 'A argamassa sozinha não é suficiente'
  const introP1 = c.fixador_intro_p1 || 'Porcelanatos de grande formato e fachadas externas sofrem com a fadiga da argamassa ao longo do tempo. Quando a aderência cede, a queda é abrupta — e pode causar acidentes graves.'
  const introP2 = c.fixador_intro_p2 || 'O Fixador Pousinox® é o reforço mecânico que garante a retenção da placa independente da argamassa — eliminando o risco de desprendimento.'
  const ctaTitulo = c.fixador_cta_titulo || 'Especifique no seu próximo projeto'
  const ctaSubtitulo = c.fixador_cta_subtitulo || 'Atendemos construtoras, empreiteiras e instaladores em todo o Brasil.'
  const waNum = c.whatsapp_numero || '5535999619463'
  const waMsgFixador = c.fixador_wa_mensagem || 'Olá, tenho interesse no Fixador de Porcelanato Pousinox. Pode me ajudar?'
  const waLinkDynamic = `https://wa.me/${waNum}?text=${encodeURIComponent(waMsgFixador)}`
  const activeFaqs = dbFaqs.length > 0 ? dbFaqs.map(f => ({ q: f.pergunta, a: f.resposta })) : faqs

  return (
    <>
      <SEO
        title="Fixador de Porcelanato em Aço Inox — Linha Especializada Pousinox®"
        description="Fixador mecânico de porcelanato em aço inoxidável, fabricado pela Pousinox® em Pouso Alegre, MG. Resistência comprovada por ensaios LAMAT/SENAI. Ancoragem complementar para fachadas, grandes formatos e revestimentos especiais."
        path="/fixador-porcelanato"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(PRODUCT_SCHEMA)}
        </script>
      </Helmet>

      {/* Hero + Stats integrados */}
      <section
        className={styles.hero}
        style={{ backgroundImage: `url(${fachadaPousinox})` }}
      >
        <div className={styles.heroOverlay} />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>{heroTitle}</h1>
            <SeloValidacao />
            <p className={styles.heroSubtitle}>{heroSub}</p>
            <div className={styles.heroStats}>
              {stats.map(s => (
                <div key={s.label} className={styles.heroStat}>
                  <span className={styles.heroStatValue}>{s.value}</span>
                  <span className={styles.heroStatLabel}>{s.label}</span>
                </div>
              ))}
            </div>
            <div className={styles.heroCta}>
              <Link to="/fixador-porcelanato/orcamento" className="btn-primary">
                Solicitar Orçamento
              </Link>
              <a
                href={waLinkDynamic}
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

      {/* Intro — por que usar */}
      <section className={`section ${styles.introSection}`}>
        <div className="container">
          <div className={styles.introGrid}>
            <div className={styles.introTexto}>
              <span className={styles.eyebrow}>Por que usar ancoragem mecânica?</span>
              <h2 className="section-title">{introTitulo}</h2>
              <p>{introP1}</p>
              <p>{introP2}</p>
              <div className={styles.introBullets}>
                {[
                  'Ancoragem independente da argamassa',
                  'Aço inoxidável — sem oxidação',
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
                alt="Fixador de Porcelanato em Aço Inox — Pousinox®"
                className={styles.produtoImg}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Aplicações */}
      <section className={`section ${styles.aplicacoesSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Principais aplicações</h2>
            <p className="section-subtitle">
              Indicado onde a argamassa sozinha não oferece segurança suficiente para toda a vida útil do revestimento.
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
            <Link to="/fixador-porcelanato/orcamento" className={styles.aplicacoesLink}>
              Solicitar orçamento para sua obra
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Como funciona — 3 etapas */}
      <section className={`section ${styles.comoSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Como funciona em 3 etapas</h2>
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
            <h2 className="section-title">Espessuras e formatos compatíveis</h2>
          </div>
          <div className={styles.compatGrid}>
            {compat.map(c => (
              <div key={c.label} className={styles.compatCard}>
                <div className={styles.compatLabel}>{c.label}</div>
                <p className={styles.compatDesc}>{c.desc}</p>
              </div>
            ))}
          </div>
          <div className={styles.compatCta}>
            <Link to="/fixador-porcelanato/ensaios" className={styles.aplicacoesLink}>
              Ver ensaios LAMAT/SENAI
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={`section ${styles.faqSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Perguntas frequentes</h2>
          </div>
          <div className={styles.faqList}>
            {activeFaqs.map((f, i) => (
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

      {/* CTA Final — compacto */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitle}>{ctaTitulo}</h2>
            <p className={styles.ctaSubtitle}>{ctaSubtitulo}</p>
            <div className={styles.ctaActions}>
              <Link to="/fixador-porcelanato/orcamento" className="btn-primary">
                Solicitar Orçamento
              </Link>
              <a
                href={waLinkDynamic}
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
