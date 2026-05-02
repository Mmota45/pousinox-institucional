import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useSiteConfig, useSiteContadores, useSiteDepoimentos, useSiteEtapas, useSiteFaq } from '../hooks/useSiteData'
import clienteAlvorada from '../assets/cliente-alvorada.png'
import clienteCimed from '../assets/cliente-cimed.svg'
import clienteMonreale from '../assets/cliente-monreale.svg'
import clienteHcsl from '../assets/cliente-hcsl.png'
import clienteUnimed from '../assets/cliente-unimed.png'
import clienteUnivas from '../assets/cliente-univas.svg'
import clienteGilsan from '../assets/cliente-gilsan.png'
import clienteBimbo from '../assets/cliente-bimbo.png'
import clienteUniaoquimica from '../assets/cliente-uniaoquimica.svg'
import clienteBiolab from '../assets/cliente-biolab.webp'
import clienteMonreve from '../assets/cliente-monreve.svg'
import heroRestaurantes from '../assets/hero-restaurantes.webp'
import heroPanificacao from '../assets/hero-panificacao.webp'
import heroHospitalar from '../assets/hero-hospitalar.webp'
import heroConstrucao from '../assets/hero-construcao.webp'
import heroHotelaria from '../assets/hero-hotelaria.webp'
import heroComercio from '../assets/hero-comercio.webp'
import heroArquitetura from '../assets/hero-arquitetura.webp'
import heroLaboratorio from '../assets/hero-laboratorio.webp'
import catRestaurantes from '../assets/cat-restaurantes.webp'
import catPanificacao from '../assets/cat-panificacao.webp'
import catHospitalar from '../assets/cat-hospitalar.webp'
import catConstrucao from '../assets/cat-construcao.webp'
import catHotelaria from '../assets/cat-hotelaria.webp'
import catComercio from '../assets/cat-comercio.webp'
import catArquitetura from '../assets/cat-arquitetura.webp'
import catLaboratorio from '../assets/cat-laboratorio.webp'
import SEO from '../components/SEO/SEO'
import styles from './Home.module.css'

const clients = [
  { src: clienteAlvorada, alt: 'Supermercados Alvorada' },
  { src: clienteUnimed, alt: 'Unimed' },
  { src: clienteMonreale, alt: 'Monreale Resort' },
  { src: clienteCimed, alt: 'Cimed' },
  { src: clienteHcsl, alt: 'Hospital e Clínica São Lucas' },
  { src: clienteUnivas, alt: 'Univás' },
  { src: clienteGilsan, alt: 'Grupo Gilsan', invert: true },
  { src: clienteBimbo, alt: 'Bimbo QSR Brasil' },
  { src: clienteUniaoquimica, alt: 'União Química' },
  { src: clienteBiolab, alt: 'Biolab Eco' },
  { src: clienteMonreve, alt: 'Monreve' },
]

const heroSlides = [heroConstrucao, heroRestaurantes, heroPanificacao, heroHospitalar, heroHotelaria, heroComercio, heroArquitetura, heroLaboratorio]

const WA_LINK = 'https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20solicitar%20um%20orçamento.'

const heroStats = [
  { target: 25, suffix: '+', label: 'Anos de experiência' },
  { target: 19, suffix: '', label: 'Segmentos atendidos' },
  { target: 500, suffix: '+', label: 'Projetos entregues' },
]

const categories = [
  {
    bg: `url(${catRestaurantes})`,
    slug: 'restaurantes',
    title: 'Restaurantes e Food Service',
    description: 'Bancadas, pias, mesas de preparo, armários e toda a linha para cozinhas profissionais de alto desempenho.',
  },
  {
    bg: `url(${catPanificacao})`,
    slug: 'panificacao',
    title: 'Panificação e Confeitaria',
    description: 'Mesas de trabalho, armários, estantes e estruturas sob medida para padarias e confeitarias.',
  },
  {
    bg: `url(${catHospitalar})`,
    slug: 'hospitalar',
    title: 'Hospitalar e Clínicas',
    description: 'Carrinhos, mesas, suportes e mobiliário com rigor higiênico e durabilidade para saúde.',
  },
  {
    bg: `url(${catLaboratorio})`,
    slug: 'laboratorio',
    title: 'Laboratório Farmacêutico',
    description: 'Bancadas, armários e estruturas em inox resistentes a produtos químicos e de fácil higienização.',
  },
  {
    bg: `url(${catHotelaria})`,
    slug: 'hotelaria',
    title: 'Hotelaria e Catering',
    description: 'Equipamentos e mobiliário em inox para hotéis, pousadas e serviços de catering e eventos.',
  },
  {
    bg: `url(${catComercio})`,
    slug: 'varejo',
    title: 'Comércio e Varejo',
    description: 'Balcões, expositores e estruturas para açougues, peixarias, padarias e supermercados.',
  },
  {
    bg: `url(${catArquitetura})`,
    slug: 'arquitetura',
    title: 'Arquitetura e Projetos Residenciais',
    description: 'Elementos decorativos e peças únicas para projetos de arquitetura e interiores de alto padrão.',
  },
  {
    bg: `url(${catConstrucao})`,
    slug: 'construcao',
    title: 'Construção Civil',
    description: 'Corrimãos, guarda-corpos, estruturas metálicas e componentes para obra com acabamento superior.',
  },
]

const steps = [
  { number: '01', title: 'Consulta', description: 'Entendemos sua necessidade, espaço disponível e objetivo do projeto.' },
  { number: '02', title: 'Projeto', description: 'Desenvolvemos o desenho técnico com todas as especificações e medidas.' },
  { number: '03', title: 'Fabricação', description: 'Produzimos na nossa fábrica com aço inox de alta qualidade e precisão.' },
  { number: '04', title: 'Entrega', description: 'Entregamos no prazo combinado. Instalação e assistência técnica quando aplicável.' },
]

const testimonials = [
  {
    name: 'Mariana Monteiro',
    avatarColor: '#4285F4',
    text: 'Adorei a loja e o atendimento. Eles têm tudo que você possa imaginar em inox e se tem algo que você precise e eles não tenham disponível, eles fazem! Muito bom.',
  },
  {
    name: 'Vanderlei Braga',
    avatarColor: '#34A853',
    text: 'Pessoal muito atencioso e dedicado. Produtos com excelente acabamento, dentre estes, destaco a churrasqueira inox a bafo — linda, altura ergonômica e o melhor de tudo: pequena, cabe em qualquer espaço.',
  },
  {
    name: 'Thamires Gonçalves',
    avatarColor: '#EA4335',
    text: 'Material com acabamento perfeito e atendimento impecável. Para quem busca uma coifa ideal para sua cozinha, eu super indico!',
  },
  {
    name: 'Elitton Wagner',
    avatarColor: '#F9A825',
    text: 'Atendimento muito bom, trabalho com dedicação e zelo. Melhor prazo de entrega da cidade.',
  },
  {
    name: 'Maria Vitória Pereira',
    avatarColor: '#9C27B0',
    text: 'Eles tratam o cliente super bem, produtos de boa qualidade, essa empresa é super profissional. Agora eu só compro lá — peço os corrimões de lá.',
  },
  {
    name: 'Denise V.',
    avatarColor: '#00ACC1',
    text: 'Excelente atendimento. Muito atenciosos. Produtos de alta qualidade. Parabéns.',
  },
]

const GOOGLE_MAPS_URL = 'https://www.google.com/maps/place/Pousinox+-+A+arte+em+inox/@-22.2430805,-45.9564762,17z'

export default function Home() {
  const { config } = useSiteConfig()
  const dbContadores = useSiteContadores()
  const dbDepoimentos = useSiteDepoimentos()
  const dbEtapas = useSiteEtapas()
  const faqItems = useSiteFaq()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Dados dinâmicos com fallback para hardcoded
  const activeStats = dbContadores.length > 0
    ? dbContadores.map(c => ({ target: c.valor, suffix: c.sufixo, label: c.label }))
    : heroStats
  const activeTestimonials = dbDepoimentos.length > 0
    ? dbDepoimentos.map(d => ({ name: d.nome, avatarColor: d.avatar_cor, text: d.texto }))
    : testimonials
  const activeSteps = dbEtapas.length > 0
    ? dbEtapas.map(e => ({ number: e.numero, title: e.titulo, description: e.descricao }))
    : steps
  const waLink = config.whatsapp_numero
    ? `https://wa.me/${config.whatsapp_numero}?text=${encodeURIComponent(config.whatsapp_mensagem || 'Olá, gostaria de solicitar um orçamento.')}`
    : WA_LINK
  const heroEyebrow = config.hero_eyebrow || 'POUSINOX® — Pouso Alegre, MG'
  const heroTitulo = config.hero_titulo || 'Fabricante de inox sob medida'
  const heroTagline = config.hero_tagline || 'para indústria, construção e projetos profissionais'
  const heroSubtitulo = config.hero_subtitulo || '25 anos fabricando bancadas, equipamentos hospitalares, corrimãos e soluções especializadas em aço inox. Atendemos todo o Brasil direto da fábrica.'
  const fabricaTitulo = config.fabrica_titulo || 'Fabricação própria do início ao fim'
  const fabricaTexto = config.fabrica_texto || 'Tecnologia de corte a laser, dobradeira CNC e solda especializada — tudo feito internamente em Pouso Alegre, MG. Controle total sobre qualidade, prazo e acabamento de cada peça.'
  const fabricaVideoUrl = config.fabrica_video_url || 'https://www.youtube.com/embed/MMMGnD7oXZM'
  const ctaTitulo = config.cta_titulo || 'Pronto para começar seu projeto?'
  const ctaSubtitulo = config.cta_subtitulo || 'Fale com nossos especialistas e receba um orçamento sem compromisso direto da fábrica.'
  const mapsUrl = config.google_maps_url || 'https://maps.app.goo.gl/bNAwCL7Jz4n3pJZx8'
  const googleRating = config.google_rating || '4,9'

  const [slide, setSlide] = useState(0)
  const [counts, setCounts] = useState(activeStats.map(s => s.target))
  const carouselRef = useRef<HTMLDivElement>(null)
  const animatedRef = useRef(false)

  const animateCounters = useCallback(() => {
    activeStats.forEach((stat, i) => {
      const duration = 1400
      const numSteps = 50
      const increment = stat.target / numSteps
      let current = 0
      const interval = setInterval(() => {
        current = Math.min(current + increment, stat.target)
        setCounts(prev => {
          const next = [...prev]
          next[i] = Math.round(current)
          return next
        })
        if (current >= stat.target) clearInterval(interval)
      }, duration / numSteps)
    })
  }, [activeStats])

  useEffect(() => {
    if (animatedRef.current) return
    animatedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCounts(activeStats.map(() => 0))
    const t = setTimeout(animateCounters, 400)
    return () => clearTimeout(t)
  }, [animateCounters, activeStats])

  function scrollCarousel(dir: 'left' | 'right') {
    const el = carouselRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'right' ? 320 : -320, behavior: 'smooth' })
  }

  useEffect(() => {
    const duration = slide === 0 ? 10000 : 5000
    const t = setTimeout(() => setSlide(s => (s + 1) % heroSlides.length), duration)
    return () => clearTimeout(t)
  }, [slide])

  return (
    <>
      <SEO
        title="POUSINOX® — Fabricante de Equipamentos em Inox em Pouso Alegre, MG"
        description="Fábrica de equipamentos e mobiliário em aço inox sob medida em Pouso Alegre, MG. Bancadas, pias, carrinhos hospitalares, corrimãos e corte a laser para todo o Sul de Minas Gerais. 25 anos de experiência."
        path="/"
      />
      {/* Hero */}
      <section className={styles.hero}>
        {/* Slides de fundo */}
        {heroSlides.map((img, i) => (
          <div
            key={i}
            className={`${styles.heroSlide} ${i === slide ? styles.heroSlideActive : ''}`}
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
        <div className={styles.heroOverlay} />

        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <span className={styles.heroEyebrow}>{heroEyebrow}</span>
            <h1 className={styles.heroTitle}>{heroTitulo}</h1>
            <p className={styles.heroTagline}>{heroTagline}</p>
            <p className={styles.heroSubtitle}>{heroSubtitulo}</p>
            <div className={styles.heroCta}>
              <Link to="/contato" className="btn-primary">
                Solicitar Orçamento
              </Link>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-whatsapp" data-source="home-hero">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Setas de navegação */}
        <button
          className={`${styles.heroArrow} ${styles.heroArrowLeft}`}
          onClick={() => setSlide(s => (s - 1 + heroSlides.length) % heroSlides.length)}
          aria-label="Slide anterior"
        >
          ‹
        </button>
        <button
          className={`${styles.heroArrow} ${styles.heroArrowRight}`}
          onClick={() => setSlide(s => (s + 1) % heroSlides.length)}
          aria-label="Próximo slide"
        >
          ›
        </button>

        {/* Stats bar */}
        <div className={styles.heroStatsBar}>
          {activeStats.map((stat, i) => (
            <div key={stat.label} className={styles.heroStatItem}>
              <span className={styles.heroStatValue}>{counts[i]}{stat.suffix}</span>
              <span className={styles.heroStatLabel}>{stat.label}</span>
            </div>
          ))}
        </div>

      </section>


      {/* Nossos Clientes */}
      <section className={styles.clients}>
        <div className={styles.clientsTicker}>
          <div className={styles.clientsTrack}>
            {[...clients, ...clients].map((c, i) => (
              <div key={i} className={styles.clientLogoWrap}>
                <img
                  src={c.src}
                  alt={c.alt}
                  className={styles.clientLogo}
                  style={c.invert ? { filter: 'invert(1) brightness(0.25)' } : undefined}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="container">
          <p className={styles.clientsLabel}>Empresas que confiam na POUSINOX®</p>
        </div>
      </section>

      {/* Categories */}
      <section className={`section ${styles.categories}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Nossas soluções em inox</h2>
            <p className="section-subtitle">
              Da cozinha industrial ao projeto de arquitetura — fabricamos sob medida
              para cada segmento com qualidade e precisão.
            </p>
          </div>
        </div>
        <div className={styles.categoryCarouselWrapper}>
          <button
            className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
            onClick={() => scrollCarousel('left')}
            aria-label="Anterior"
          >
            ‹
          </button>
          <div className={styles.categoryCarousel} ref={carouselRef}>
          <div className={styles.categoryTrack}>
            {categories.map((cat) => (
              <div
                key={cat.title}
                className={styles.categoryCard}
                style={{ backgroundImage: cat.bg }}
              >
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{cat.title}</h3>
                  <p className={styles.cardDesc}>{cat.description}</p>
                </div>
                <Link to={`/segmentos/${cat.slug}`} className={styles.cardBtn}>
                  Ver linha →
                </Link>
              </div>
            ))}
          </div>
          </div>
          <button
            className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
            onClick={() => scrollCarousel('right')}
            aria-label="Próximo"
          >
            ›
          </button>
        </div>
      </section>

      {/* How it works */}
      <section className={`section ${styles.howItWorks}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Como funciona</h2>
            <p className="section-subtitle">
              Um processo simples e transparente do primeiro contato à entrega.
            </p>
          </div>
          <div className={styles.stepsGrid}>
            {activeSteps.map((step, i) => (
              <div key={step.number} className={styles.stepItem}>
                <div className={styles.stepNumber}>{step.number}</div>
                {i < activeSteps.length - 1 && <div className={styles.stepConnector} />}
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fábrica em operação */}
      <section className={`section ${styles.fabricaSection}`}>
        <div className="container">
          <div className={styles.fabricaGrid}>
            <div className={styles.fabricaVideo}>
              <iframe
                src={fabricaVideoUrl}
                title="Corte a Laser em Chapas Metálicas — Pousinox"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={styles.videoFrame}
              />
            </div>
            <div className={styles.fabricaTexto}>
              <span className={styles.fabricaEyebrow}>Nossa fábrica</span>
              <h2 className="section-title">{fabricaTitulo}</h2>
              <p>{fabricaTexto}</p>
              <Link to="/sobre" className="btn-primary">Conheça a POUSINOX®</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Corte a Laser — teaser */}
      <section className={styles.laserSection}>
        <div className={styles.laserOverlay} />
        <div className={`container ${styles.laserInner}`}>
          <div className={styles.laserTexto}>
            <span className={styles.laserEyebrow}>Serviço especializado</span>
            <h2 className={styles.laserTitle}>Corte a Laser em Chapas Metálicas</h2>
            <p className={styles.laserDesc}>
              Aço inox (304, 430 e 316), aço carbono e ligas de alumínio —
              precisão milimétrica para chapas, peças decorativas, letras, logos
              e recortes personalizados. Bordas limpas, sem rebarbas, qualquer geometria.
            </p>
            <Link to="/servicos/corte-laser" className={styles.laserBtn}>
              Conhecer o serviço
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          </div>
          <div className={styles.laserFeatures}>
            {[
              'Precisão milimétrica',
              'Sem deformação do material',
              'Bordas limpas, sem rebarbas',
              'Qualquer geometria possível',
            ].map(f => (
              <div key={f} className={styles.laserFeatureItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className={`section ${styles.testimonials}`}>
        <div className="container">
          <div className={styles.testimonialsHeader}>
            <div className={styles.testimonialsTitle}>
              <h2 className="section-title">O que dizem nossos clientes</h2>
              <div className={styles.googleRating}>
                <svg className={styles.googleLogo} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className={styles.googleRatingScore}>{googleRating}</span>
                <span className={styles.googleRatingStars}>★★★★★</span>
                <span className={styles.googleRatingLabel}>no Google</span>
              </div>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.googleLink}
            >
              Ver todas as avaliações
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
          <div className={styles.testimonialsGrid}>
            {activeTestimonials.map((t) => (
              <div key={t.name} className={styles.testimonialCard}>
                <div className={styles.testimonialCardTop}>
                  <div className={styles.testimonialAuthor}>
                    <div
                      className={styles.testimonialAvatar}
                      style={{ background: t.avatarColor }}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <strong>{t.name}</strong>
                      <span>Avaliação no Google</span>
                    </div>
                  </div>
                  <svg className={styles.cardGoogleLogo} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div className={styles.testimonialStars}>★★★★★</div>
                <p className={styles.testimonialText}>"{t.text}"</p>
              </div>
            ))}
          </div>

          <div className={styles.mapsBar}>
            <a href="https://maps.app.goo.gl/bNAwCL7Jz4n3pJZx8" target="_blank" rel="noopener noreferrer" className={styles.mapsLink}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              POUSINOX® — Pouso Alegre, MG · Ver localização no Google Maps ↗
            </a>
          </div>
        </div>
      </section>

      {/* Fixador de Porcelanato — teaser */}
      <section className={`section ${styles.fixadorSection}`}>
        <div className="container">
          <div className={styles.fixadorGrid}>
            <div className={styles.fixadorTexto}>
              <span className={styles.fixadorEyebrow}>Solução técnica exclusiva</span>
              <h2 className="section-title">Fixador de Porcelanato POUSINOX®</h2>
              <p>
                Sistema de fixação mecânica em aço inox para fachadas, grandes formatos e
                áreas externas. Aprovado em ensaios laboratoriais LAMAT/SENAI —
                a solução que construtoras e empreiteiras precisam para obras que durem décadas.
              </p>
              <ul className={styles.fixadorBullets}>
                {[
                  'Compatível com porcelanatos de 5 mm a 25 mm',
                  'Resistência a cargas e variação térmica comprovada em laboratório',
                  'Documentação técnica completa para projetos e licitações',
                  'Produção sob demanda com entrega para todo o Brasil',
                ].map(item => (
                  <li key={item} className={styles.fixadorBullet}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <div className={styles.fixadorActions}>
                <Link to="/fixador-porcelanato/orcamento" className="btn-primary">
                  Solicitar Orçamento
                </Link>
                <Link to="/fixador-porcelanato/calculadora" className="btn-outline-dark">
                  Calcular materiais →
                </Link>
              </div>
            </div>
            <div className={styles.fixadorVisual}>
              <p className={styles.fixadorVisualTitle}>Desempenho comprovado</p>
              {[
                { value: '100%', label: 'Aço inox AISI 304', divider: true },
                { value: 'LAMAT', label: 'Ensaio laboratorial SENAI', divider: true },
                { value: '5–25mm', label: 'Espessuras compatíveis', divider: false },
              ].map(({ value, label, divider }) => (
                <Fragment key={value}>
                  <div className={styles.fixadorStat}>
                    <span className={styles.fixadorStatValue}>{value}</span>
                    <span className={styles.fixadorStatLabel}>{label}</span>
                  </div>
                  {divider && <div className={styles.fixadorStatDivider} />}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      {faqItems.length > 0 && (
        <section className={`section ${styles.faqSection}`}>
          <div className="container">
            <div className={styles.sectionHead}>
              <h2 className="section-title">Perguntas frequentes</h2>
              <p className="section-subtitle">Tire suas dúvidas sobre nossos produtos e serviços.</p>
            </div>
            <div className={styles.faqList}>
              {faqItems.map(f => (
                <div key={f.id} className={styles.faqItem} data-open={openFaq === f.id || undefined}>
                  <button className={styles.faqQuestion} onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}>
                    <span>{f.pergunta}</span>
                    <span className={styles.faqIcon}>{openFaq === f.id ? '−' : '+'}</span>
                  </button>
                  {openFaq === f.id && <div className={styles.faqAnswer}>{f.resposta}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitle}>{ctaTitulo}</h2>
            <p className={styles.ctaSubtitle}>{ctaSubtitulo}</p>
            <div className={styles.ctaActions}>
              <Link to="/contato" className="btn-white">
                Solicitar Orçamento
              </Link>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-whatsapp" data-source="home-cta">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
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
