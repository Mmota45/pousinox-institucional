import { Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'
import styles from './FixadorNormas.module.css'

const WA_LINK =
  'https://wa.me/553534238994?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20t%C3%A9cnico%20para%20especificar%20o%20Fixador%20Pousinox%20em%20projeto.'

const normas = [
  {
    codigo: 'NBR 13754',
    titulo: 'Revestimento de paredes e tetos internos com placas cerâmicas',
    descricao:
      'Define requisitos e métodos de ensaio para assentamento de revestimentos cerâmicos em paredes e tetos interiores com argamassa colante. Referência primária para especificação de fixação em ambientes internos.',
    relevancia:
      'O Fixador Pousinox complementa o sistema de argamassa exigido por esta norma, adicionando ancoragem mecânica independente.',
    aplicacao: 'Paredes internas · Tetos · Ambientes molhados',
  },
  {
    codigo: 'NBR 14081',
    titulo: 'Argamassa colante industrializada para assentamento de placas cerâmicas',
    descricao:
      'Classifica as argamassas colantes (AC-I, AC-II, AC-III) e define requisitos de resistência de aderência. A norma reconhece limitações de desempenho a longo prazo da argamassa em condições adversas.',
    relevancia:
      'Obras com argamassa AC-II ou AC-III em fachadas se beneficiam de ancoragem mecânica adicional para segurança em todo o ciclo de vida.',
    aplicacao: 'Fachadas externas · Ambientes sujeitos a umidade · Grandes formatos',
  },
  {
    codigo: 'NBR 13755',
    titulo: 'Revestimento de paredes externas e fachadas com placas cerâmicas',
    descricao:
      'Norma específica para fachadas cerâmicas. Define requisitos de projeto, execução e desempenho para revestimentos externos com placas cerâmicas e porcelanatos. Reconhece que fachadas exigem critérios mais rigorosos que paredes internas.',
    relevancia:
      'Esta é a principal norma que fundamenta a recomendação de ancoragem mecânica em fachadas. O fixador Pousinox atende ao conceito de segurança adicional previsto na norma.',
    aplicacao: 'Fachadas · Revestimentos externos · Alturas elevadas',
  },
  {
    codigo: 'NBR 15575',
    titulo: 'Edificações habitacionais — Desempenho',
    descricao:
      'Norma de desempenho para edificações habitacionais que define requisitos de segurança estrutural, estanqueidade, durabilidade e manutenção para sistemas de revestimento. Inclui critérios para o comportamento das fachadas ao longo da vida útil da edificação.',
    relevancia:
      'A vida útil de projeto prevista pela NBR 15575 para sistemas de fachada reforça a necessidade de ancoragem mecânica como medida de segurança de longo prazo.',
    aplicacao: 'Edificações habitacionais · Fachadas · Sistemas de vedação',
  },
]

const boasPraticas = [
  {
    titulo: 'Use argamassa AC-III em fachadas',
    desc: 'A NBR 13755 recomenda AC-III para revestimentos externos. Combine com o fixador Pousinox para segurança máxima.',
  },
  {
    titulo: 'Fixador obrigatório acima de 2,5 m',
    desc: 'Para fachadas acima de 2,5 m de altura, a ancoragem mecânica é considerada boa prática de engenharia para mitigar risco de queda.',
  },
  {
    titulo: 'Documente no memorial descritivo',
    desc: 'Inclua o fixador Pousinox e os ensaios LAMAT/SENAI Itaúna no memorial descritivo — facilita aprovação em projetos e laudos técnicos.',
  },
  {
    titulo: 'Espaçamento correto',
    desc: 'Para placas até 60×60 cm, um fixador por placa. Para grandes formatos, dois ou mais fixadores distribuídos nas bordas.',
  },
]

export default function FixadorNormas() {
  return (
    <>
      <SEO
        title="Normas Técnicas — Fixador de Porcelanato Pousinox"
        description="Referências normativas ABNT para especificação do Fixador de Porcelanato Pousinox: NBR 13754, NBR 14081, NBR 13755 e NBR 15575. Guia de boas práticas para engenheiros e arquitetos."
        path="/fixador-porcelanato/normas"
      />

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className="container">
          <div className={styles.breadcrumb}>
            <Link to="/fixador-porcelanato">Fixador de Porcelanato</Link>
            <span>/</span>
            <span>Normas Técnicas</span>
          </div>
          <h1 className={styles.pageTitle}>Normas e Referências Técnicas</h1>
          <p className={styles.pageSubtitle}>
            Referências normativas ABNT para especificação do Fixador de Porcelanato Pousinox
            em projetos de engenharia e arquitetura — fachadas, revestimentos externos e
            grandes formatos.
          </p>
        </div>
      </div>

      {/* Normas */}
      <section className={`section ${styles.normasSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Normas ABNT Aplicáveis</h2>
            <p className="section-subtitle">
              Quatro normas formam a base técnica para especificação de revestimentos cerâmicos
              e fixação mecânica em obras profissionais.
            </p>
          </div>
          <div className={styles.normasLista}>
            {normas.map(n => (
              <div key={n.codigo} className={styles.normaCard}>
                <div className={styles.normaCodigo}>{n.codigo}</div>
                <div className={styles.normaConteudo}>
                  <h3 className={styles.normaTitulo}>{n.titulo}</h3>
                  <p className={styles.normaDesc}>{n.descricao}</p>
                  <div className={styles.normaRelevancia}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>{n.relevancia}</span>
                  </div>
                  <div className={styles.normaAplicacao}>
                    <span className={styles.normaAplicacaoLabel}>Aplicação:</span>
                    {n.aplicacao}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Boas práticas */}
      <section className={`section ${styles.praticasSection}`}>
        <div className="container">
          <div className={styles.sectionHead}>
            <h2 className="section-title">Boas Práticas de Especificação</h2>
            <p className="section-subtitle">
              Recomendações para engenheiros, arquitetos e especificadores ao incluir
              o Fixador Pousinox em projetos e memoriais descritivos.
            </p>
          </div>
          <div className={styles.praticasGrid}>
            {boasPraticas.map(p => (
              <div key={p.titulo} className={styles.praticaCard}>
                <div className={styles.praticaCheck}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.praticaTitulo}>{p.titulo}</h3>
                  <p className={styles.praticaDesc}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Suporte técnico */}
      <section className={`section ${styles.suporteSection}`}>
        <div className="container">
          <div className={styles.suporteInner}>
            <div className={styles.suporteTexto}>
              <span className={styles.eyebrow}>Suporte técnico especializado</span>
              <h2 className="section-title">Precisa incluir o fixador no projeto?</h2>
              <p>
                Nossa equipe técnica pode auxiliar na especificação correta do produto,
                indicar o modelo mais adequado para cada aplicação e fornecer documentação
                técnica para composição de memoriais descritivos, laudos e projetos executivos.
              </p>
              <div className={styles.suporteActions}>
                <a
                  href={WA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp"
                  data-source="fixador-normas"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Falar com técnico
                </a>
                <Link to="/fixador-porcelanato/orcamento" className="btn-outline">
                  Solicitar Orçamento
                </Link>
              </div>
            </div>
            <div className={styles.suporteLinks}>
              <h3 className={styles.suporteLinksTitulo}>Mais informações técnicas</h3>
              <div className={styles.suporteLinksList}>
                <Link to="/fixador-porcelanato/ensaios" className={styles.suporteLink}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  Ensaios LAMAT/SENAI Itaúna — Resistência comprovada
                </Link>
                <Link to="/fixador-porcelanato/fachadas" className={styles.suporteLink}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="18" rx="2" /><line x1="8" y1="21" x2="8" y2="3" /><line x1="16" y1="21" x2="16" y2="3" />
                  </svg>
                  Aplicações em fachadas e grandes formatos
                </Link>
                <Link to="/fixador-porcelanato" className={styles.suporteLink}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Visão geral do produto e especificações
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
