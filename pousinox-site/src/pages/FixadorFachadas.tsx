import { Link } from 'react-router-dom'
import fachadaPousinox from '../assets/fachada-pousinox.webp'
import SEO from '../components/SEO/SEO'
import styles from './FixadorFachadas.module.css'

const passos = [
  {
    num: '01',
    titulo: 'Incisão na peça',
    desc: 'Com ferramenta específica, faz-se a incisão na borda do porcelanato para encaixe do fixador.',
    img: '/passo-incisao.webp',
  },
  {
    num: '02',
    titulo: 'Posicionar o fixador',
    desc: 'O fixador metálico é encaixado na incisão da borda da placa, posicionado para ancoragem.',
    img: '/passo-posicao.webp',
  },
  {
    num: '03',
    titulo: 'Peças preparadas',
    desc: 'Placas com fixadores encaixados prontas para assentamento — processo rápido e simples em obra.',
    img: '/passo-preparacao.webp',
  },
  {
    num: '04',
    titulo: 'Instalação na parede',
    desc: 'As placas são assentadas com argamassa e o fixador é ancorado na alvenaria com bucha prego.',
    img: '/passo-instalacao.webp',
  },
]

const WA_LINK =
  'https://wa.me/553534238994?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20Fixador%20de%20Porcelanato%20para%20fachada.%20Pode%20me%20ajudar%3F'

const aplicacoes = [
  {
    title: 'Fachadas Externas',
    desc: 'Revestimentos em fachadas expostas a chuva, vento e variação térmica acentuada. O fixador garante ancoragem mesmo com dilatação e contração das placas.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="18" rx="2" /><line x1="8" y1="21" x2="8" y2="3" /><line x1="16" y1="21" x2="16" y2="3" /><line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    title: 'Porcelanato Grande Formato',
    desc: 'Placas 60×120, 80×160, 100×300 cm e similares concentram muito peso. A ancoragem mecânica distribui a carga e elimina o risco de deslocamento.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
      </svg>
    ),
  },
  {
    title: 'Varandas e Áreas Externas',
    desc: 'Ambientes com exposição à umidade constante e limpeza periódica com produtos químicos. O aço inoxidável não corrói nem mancha.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    title: 'Obras Comerciais e Corporativas',
    desc: 'Lobbies, halls, fachadas de lojas e edifícios comerciais com alto tráfego e revestimentos de padrão elevado que não podem apresentar falhas.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    title: 'Revestimentos em Altura',
    desc: 'Paredes acima de 2,5 m, mezaninos e fachadas de múltiplos andares onde o risco de queda de placa representa perigo direto a pedestres.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" />
      </svg>
    ),
  },
  {
    title: 'Obras Residenciais de Alto Padrão',
    desc: 'Projetos de arquitetura com revestimentos especiais, pedras artificiais e porcelanatos de grande valor onde qualidade de fixação é requisito.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
]

const riscos = [
  {
    titulo: 'Dilatação térmica',
    desc: 'Fachadas expostas ao sol sofrem variações de temperatura de até 60°C. Isso gera expansão e contração cíclica que fadiga a argamassa.',
  },
  {
    titulo: 'Umidade e ciclos de molhagem',
    desc: 'Água penetra nas micro-fissuras da argamassa, causa cristalização de sais e degrada progressivamente a aderência.',
  },
  {
    titulo: 'Vibração e recalque',
    desc: 'Movimentação estrutural do edifício e vibração de tráfego pesado próximo podem soltar placas já com aderência comprometida.',
  },
  {
    titulo: 'Peso das placas de grande formato',
    desc: 'Uma placa 80×160 cm de porcelanato pode pesar mais de 15 kg. Sem ancoragem mecânica, todo o peso depende exclusivamente da argamassa.',
  },
]

export default function FixadorFachadas() {
  return (
    <>
      <SEO
        title="Fixador de Porcelanato para Fachadas e Grandes Formatos — Pousinox"
        description="Ancoragem mecânica em aço inox para fachadas externas, grandes formatos e revestimentos especiais. Fabricado pela Pousinox em Pouso Alegre, MG. Segurança comprovada por ensaios laboratoriais."
        path="/fixador-porcelanato/fachadas"
      />

      {/* Hero */}
      <section
        className={styles.hero}
        style={{ backgroundImage: `url(${fachadaPousinox})` }}
      >
        <div className={styles.heroOverlay} />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroBreadcrumb}>
            <Link to="/fixador-porcelanato">Fixador de Porcelanato</Link>
            <span>/</span>
            <span>Fachadas e Grandes Formatos</span>
          </div>
          <div className={styles.heroContent}>
            <span className={styles.heroEyebrow}>Aplicação especializada</span>
            <h1 className={styles.heroTitle}>
              Fixação Mecânica para<br />
              <span className={styles.heroHighlight}>Fachadas e Grandes Formatos</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Ancoragem complementar em aço inox para revestimentos de fachada e porcelanatos
              de grande formato — onde a falha da argamassa não pode ser a única linha de defesa.
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
                data-source="fixador-fachadas-hero"
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

      {/* Riscos */}
      <section className={`section ${styles.riscosSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Por que a argamassa não é suficiente</span>
            <h2 className="section-title">Fatores de risco em fachadas</h2>
            <p className="section-subtitle">
              A NBR 13755 reconhece que fachadas cerâmicas exigem atenção especial à aderência.
              Veja os principais mecanismos de falha em revestimentos externos.
            </p>
          </div>
          <div className={styles.riscosGrid}>
            {riscos.map((r, i) => (
              <div key={r.titulo} className={styles.riscoCard}>
                <div className={styles.riscoNum}>{String(i + 1).padStart(2, '0')}</div>
                <h3 className={styles.riscoTitulo}>{r.titulo}</h3>
                <p className={styles.riscoDesc}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Aplicações */}
      <section className={`section ${styles.aplicacoesSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Onde o Fixador Pousinox é indicado</h2>
            <p className="section-subtitle">
              Aplicações que exigem segurança máxima na fixação de revestimentos cerâmicos.
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

      {/* Como funciona */}
      <section className={`section ${styles.comoSection}`}>
        <div className="container">
          <div className={styles.comoGrid}>
            <div className={styles.comoTexto}>
              <span className={styles.eyebrow}>Processo de instalação</span>
              <h2 className="section-title">Como funciona em fachada</h2>
              <p>
                O fixador é aplicado no tardoz do porcelanato antes da colagem. A aba metálica
                envolve a borda da placa e é ancorada na alvenaria por bucha prego, criando
                uma segunda linha de retenção independente da argamassa.
              </p>
              <ol className={styles.comoPassos}>
                <li>
                  <div><strong>Preparação da placa:</strong> fixador é posicionado no tardoz aproveitando o rasgo do corte ou borda da placa.</div>
                </li>
                <li>
                  <div><strong>Aplicação da argamassa:</strong> a placa é colada normalmente com argamassa AC-III, cobrindo também o fixador.</div>
                </li>
                <li>
                  <div><strong>Ancoragem na alvenaria:</strong> a aba externa do fixador é fixada na parede com bucha prego 6×38 mm.</div>
                </li>
                <li>
                  <div><strong>Resultado:</strong> a placa fica mecanicamente travada na estrutura, independente do desempenho futuro da argamassa.</div>
                </li>
              </ol>
            </div>
            <div className={styles.comoImagem}>
              <img
                src="/fixador-bucha-prego.webp"
                alt="Fixador de porcelanato com bucha prego — Pousinox"
                className={styles.buchaImg}
                loading="lazy"
              />
              <div className={styles.comoCaption}>Fixador Pousinox com bucha prego</div>
            </div>
          </div>
        </div>
      </section>

      {/* Como instalar — 4 etapas */}
      <section className={`section ${styles.passosSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Como instalar — 4 etapas</h2>
            <p className="section-subtitle">
              Processo objetivo, executado em obra por qualquer instalador profissional com experiência em revestimentos.
            </p>
          </div>
          <div className={styles.passosGrid}>
            {passos.map(p => (
              <div key={p.num} className={styles.passoCard}>
                <div className={styles.passoImgWrap}>
                  <img
                    src={p.img}
                    alt={p.titulo}
                    className={styles.passoImg}
                    loading="lazy"
                  />
                  <span className={styles.passoNum}>{p.num}</span>
                </div>
                <div className={styles.passoTexto}>
                  <h3 className={styles.passoTitulo}>{p.titulo}</h3>
                  <p className={styles.passoDesc}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaBox}>
            <h2 className={styles.ctaTitle}>
              Fachada segura começa na especificação
            </h2>
            <p className={styles.ctaSubtitle}>
              Inclua o Fixador Pousinox no memorial descritivo do projeto e garanta
              segurança estrutural comprovada em laboratório.
            </p>
            <div className={styles.ctaActions}>
              <Link to="/fixador-porcelanato/orcamento" className="btn-primary">
                Solicitar Orçamento
              </Link>
              <Link to="/fixador-porcelanato/ensaios" className={styles.btnOutlineLight}>
                Ver Ensaios LAMAT/SENAI
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
