import SEO from '../components/SEO/SEO'
import fachada from '../assets/fachada-sede.webp'
import styles from './Sobre.module.css'

const expertise = [
  'Restaurantes e Food Service',
  'Panificação e Confeitaria',
  'Hospitalar e Clínicas',
  'Laboratório Farmacêutico',
  'Hotelaria e Catering',
  'Comércio e Varejo',
  'Arquitetura e Projetos Residenciais',
  'Construção Civil',
]

const filosofia = [
  { title: 'Engenharia sob medida', desc: 'Cada projeto é desenvolvido com base nas necessidades reais do cliente e do ambiente.' },
  { title: 'Tecnologia de ponta', desc: 'Estrutura fabril com tecnologia CNC e equipe técnica especializada em todas as etapas.' },
  { title: 'Acabamento premium', desc: 'Eficiência operacional, higiene, durabilidade e acabamento superior em cada entrega.' },
  { title: 'Visão consultiva', desc: 'Atuamos como parceiros estratégicos — do projeto à instalação, com assistência técnica permanente.' },
]

export default function Sobre() {
  return (
    <div className={styles.page}>
      <SEO
        title="Sobre a POUSINOX® — Fábrica de Inox em Pouso Alegre, MG desde 2001"
        description="Fundada em 2001, a POUSINOX® fabrica equipamentos em aço inox sob medida em Pouso Alegre, MG. 25 anos atendendo restaurantes, hospitais e indústrias no Sul de Minas Gerais e em todo o Brasil."
        path="/sobre"
      />
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <h1 className={styles.pageTitle}>Quem Somos</h1>
          <p className={styles.pageSubtitle}>
            "Soluções em inox que elevam ambientes."
          </p>
        </div>
      </div>

      {/* Quem somos */}
      <section className={`section ${styles.quemSomos}`}>
        <div className="container">
          <div className={styles.quemSomosGrid}>
            <div className={styles.quemSomosContent}>
              <h2 className="section-title">Há mais de duas décadas elevando padrões</h2>
              <p>
                A POUSINOX® desenvolve soluções em aço inox que elevam o padrão de ambientes
                industriais, comerciais e residenciais em todo o Brasil. Mais do que fabricar
                equipamentos, projetamos soluções sob medida que combinam eficiência operacional,
                higiene, durabilidade e acabamento superior — atendendo necessidades reais de
                cada cliente e de cada projeto.
              </p>
              <p>
                Com estrutura fabril própria, tecnologia CNC e uma equipe técnica especializada,
                atuamos em todas as etapas: do projeto à instalação, garantindo performance e
                confiabilidade em cada entrega.
              </p>
              <p className={styles.destaque}>
                Nosso compromisso é transformar o inox em um elemento estratégico para o
                funcionamento, a produtividade e a longevidade dos ambientes.
              </p>
            </div>
            <div className={styles.quemSomosStats}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>2001</span>
                <span className={styles.statLabel}>Ano de fundação</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>25+</span>
                <span className={styles.statLabel}>Anos de experiência</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>CNC</span>
                <span className={styles.statLabel}>Tecnologia de fabricação</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>BR</span>
                <span className={styles.statLabel}>Atendimento em todo o Brasil</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nossa Expertise */}
      <section className={`section ${styles.expertiseSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Nossa Expertise</h2>
            <p className="section-subtitle">
              Atendemos diversos segmentos que exigem alto padrão técnico e precisão.
              Cada solução é desenvolvida sob medida para integrar funcionalidade,
              ergonomia e resistência.
            </p>
          </div>
          <div className={styles.expertiseGrid}>
            {expertise.map((item) => (
              <div key={item} className={styles.expertiseItem}>
                <span className={styles.expertiseCheck}>✦</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className={styles.expertiseNote}>
            Com assistência técnica permanente e foco total na satisfação do cliente.
          </p>
        </div>
      </section>

      {/* Veja nossa fábrica */}
      <section className={`section ${styles.fabricaSection}`}>
        <div className="container">
          <div className={styles.fabricaGrid}>
            <div className={styles.fabricaTexto}>
              <h2 className="section-title">Veja nossa fábrica em operação</h2>
              <p>
                Tecnologia de corte a laser aplicada ao aço inox com precisão milimétrica.
                É assim que cada peça da POUSINOX® começa — com processo controlado,
                equipamento de ponta e mão de obra especializada.
              </p>
              <p>
                Da programação CNC ao acabamento final, fabricamos tudo internamente.
                Isso garante qualidade, prazo e rastreabilidade em cada projeto entregue.
              </p>
            </div>
            <div className={styles.fabricaVideo}>
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

      {/* Nossa História */}
      <section className={`section ${styles.historiaSection}`}>
        <div className="container">
          <div className={styles.historiaCols}>
            <div className={styles.historiaLabel}>
              <h2 className="section-title">Nossa História</h2>
            </div>
            <div className={styles.historiaTexto}>
              <p>
                A história da POUSINOX® começou com a visão de um jovem empreendedor apaixonado
                pela área metalúrgica, formado em cursos técnicos do Senai e movido pelo desejo
                de elevar a qualidade dos projetos em inox no mercado brasileiro.
              </p>
              <p>
                Após anos de experiência prática atendendo clientes e compreendendo suas
                necessidades reais, nasceu em <strong>2001</strong> a POUSINOX® — inicialmente
                em uma garagem, com poucos recursos, mas com um propósito claro: entregar
                excelência através do trabalho bem feito.
              </p>
              <p>
                Com dedicação, evolução constante e foco no cliente, a empresa cresceu,
                conquistou sede própria em Pouso Alegre (MG) e hoje conta com
                <strong> estrutura industrial moderna</strong> para atender projetos em
                todo o território nacional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Nossa Sede */}
      <section className={styles.sedeSection}>
        <div className={styles.sedeGrid}>
          <div className={styles.sedeImgWrap}>
            <img src={fachada} alt="Fachada da sede da POUSINOX em Pouso Alegre, MG" className={styles.sedeImg} loading="lazy" />
          </div>
          <div className={styles.sedeContent}>
            <h2 className={styles.sedeTitulo}>Nossa Sede</h2>
            <p className={styles.sedeTexto}>
              Fábrica, showroom e atendimento técnico no mesmo endereço — estrutura industrial
              própria construída ao longo de mais de 25 anos.
            </p>

            <div className={styles.sedeStats}>
              <div className={styles.sedeStat}>
                <span className={styles.sedeStatNum}>25+</span>
                <span className={styles.sedeStatLabel}>anos de história</span>
              </div>
              <div className={styles.sedeStat}>
                <span className={styles.sedeStatNum}>3</span>
                <span className={styles.sedeStatLabel}>em 1 — fábrica, showroom e suporte</span>
              </div>
            </div>

            <div className={styles.sedeInfoList}>
              <div className={styles.sedeInfoItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>Av. Antonio Mariosa, 4545 — Santa Angelina, Pouso Alegre, MG</span>
              </div>
              <div className={styles.sedeInfoItem}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>Seg–Qui: 7h30–18h &nbsp;·&nbsp; Sex: 7h30–17h</span>
              </div>
            </div>

            <a href="https://maps.app.goo.gl/bNAwCL7Jz4n3pJZx8" target="_blank" rel="noopener noreferrer" className={styles.sedeCta}>
              Ver no Google Maps ↗
            </a>
          </div>
        </div>
      </section>

      {/* Nossa Filosofia */}
      <section className={`section ${styles.filosofiaSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Nossa Filosofia</h2>
            <p className="section-subtitle">
              Cada projeto é único. Cada solução deve melhorar o ambiente onde será utilizada.
            </p>
          </div>
          <div className={styles.filosofiaGrid}>
            {filosofia.map((item) => (
              <div key={item.title} className={styles.filosofiaCard}>
                <h3 className={styles.filosofiaTitle}>{item.title}</h3>
                <p className={styles.filosofiaDesc}>{item.desc}</p>
              </div>
            ))}
          </div>
          <blockquote className={styles.lema}>
            "Soluções em inox que elevam ambientes."
          </blockquote>
        </div>
      </section>

    </div>
  )
}
