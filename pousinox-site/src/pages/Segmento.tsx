import { Link, useParams, Navigate } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import { segmentoMap } from '../data/segmentos'
import styles from './Segmento.module.css'

const WA_LINK = 'https://wa.me/553534238994?text=Olá%2C%20gostaria%20de%20solicitar%20um%20orçamento.'

export default function Segmento() {
  const { slug } = useParams<{ slug: string }>()
  const seg = slug ? segmentoMap[slug] : null

  if (!seg) return <Navigate to="/produtos" replace />

  return (
    <>
      <SEO
        title={seg.seoTitle}
        description={seg.seoDescription}
        path={`/segmentos/${seg.slug}`}
        extraSchema={[
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `A Pousinox fabrica equipamentos em inox para ${seg.name}?`,
                acceptedAnswer: { '@type': 'Answer', text: `Sim. A Pousinox fabrica equipamentos e mobiliário em aço inox sob medida para o segmento de ${seg.name}. Todos os produtos são fabricados na nossa fábrica em Pouso Alegre/MG com aço inox de alta qualidade.` },
              },
              {
                '@type': 'Question',
                name: `Como solicitar orçamento de inox para ${seg.name}?`,
                acceptedAnswer: { '@type': 'Answer', text: `Entre em contato pelo WhatsApp (35) 3423-8994, pelo formulário no site ou por e-mail. Envie as medidas e especificações desejadas e nossa equipe retorna em até 24 horas com o orçamento personalizado.` },
              },
            ],
          },
        ]}
      />

      {/* Hero */}
      <section
        className={styles.hero}
        style={{ backgroundImage: `url(${seg.image})` }}
      >
        <div className={styles.heroOverlay} />
        <div className={`container ${styles.heroInner}`}>
          <Link to="/produtos" className={styles.breadcrumb}>
            ← Todos os segmentos
          </Link>
          <h1 className={styles.heroTitle}>{seg.titulo}</h1>
          <p className={styles.heroTagline}>{seg.tagline}</p>
          <div className={styles.heroCta}>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Falar no WhatsApp
            </a>
            <Link to="/contato" className={`btn-outline ${styles.btnOutlineHero}`}>
              Solicitar Orçamento
            </Link>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className={`section ${styles.introSection}`}>
        <div className="container">
          <p className={styles.introText}>{seg.intro}</p>
        </div>
      </section>

      {/* Produtos */}
      <section className={`section ${styles.produtosSection}`}>
        <div className="container">
          <h2 className={`section-title ${styles.sectionTitle}`}>
            O que fabricamos para {seg.titulo}
          </h2>
          <div className={styles.produtosGrid}>
            {seg.produtos.map(item => (
              <div key={item} className={styles.produtoItem}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {item}
              </div>
            ))}
          </div>
          <div className={styles.produtosCta}>
            <p>Precisa de algo específico? Fabricamos sob medida para qualquer necessidade.</p>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Consultar disponibilidade
            </a>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className={`section ${styles.benefSection}`}>
        <div className="container">
          <h2 className={`section-title ${styles.sectionTitle}`}>
            Por que inox para {seg.titulo.split(' e ')[0].split(' e ')[0]}?
          </h2>
          <div className={styles.benefGrid}>
            {seg.beneficios.map(b => (
              <div key={b.titulo} className={styles.benefCard}>
                <div className={styles.benefIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className={styles.benefTitle}>{b.titulo}</h3>
                <p className={styles.benefText}>{b.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitle}>Pronto para começar seu projeto?</h2>
            <p className={styles.ctaSubtitle}>
              Fabricamos sob medida direto da fábrica em Pouso Alegre, MG — com entrega para todo o Brasil.
            </p>
            <div className={styles.ctaActions}>
              <Link to="/contato" className="btn-white">
                Solicitar Orçamento
              </Link>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn-whatsapp" data-source={`segmento-${seg.slug}`}>
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
